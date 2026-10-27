import tempfile
from pathlib import Path
from django.core import mail
from .password_reset import make_token
from django.test import override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from .models import User, Company, Category, Ad, Application, Message


class ApplicationCVTests(APITestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        override = override_settings(MEDIA_ROOT=directory.name)
        override.enable()
        self.addCleanup(override.disable)
        self.candidate = User.objects.create_user(email="candidate@example.com", password="test")
        self.recruiter = User.objects.create_user(email="recruiter@example.com", role="recruiter")
        company = Company.objects.create(name="Company", siret="12345678901234")
        category = Category.objects.create(name="IT", slug="it")
        self.ad = Ad.objects.create(title="Dev", company=company, recruiter=self.recruiter,
                                    category=category, contract_type="CDI")
        self.client.force_authenticate(self.candidate)
        self.payload = dict(first_name="Jane", last_name="Doe", email="candidate@example.com", message="Bonjour")

    def pdf(self, name="resume.pdf"):
        return SimpleUploadedFile(name, b"%PDF-1.4\nCV test", content_type="application/pdf")

    def apply(self, **extra):
        return self.client.post(f"/api/ads/{self.ad.pk}/apply", {**self.payload, **extra}, format="multipart")

    def test_upload_saves_file_and_profile_and_protects_download(self):
        response = self.apply(cv=self.pdf())
        self.assertEqual(response.status_code, 201, response.data)
        application = Application.objects.get()
        self.candidate.refresh_from_db()
        self.assertEqual(self.candidate.cv.name, application.cv.name)
        self.assertEqual(Path(application.cv.path).read_bytes(), b"%PDF-1.4\nCV test")
        url = response.data["cv_download_url"]
        for user in (self.candidate, self.recruiter):
            self.client.force_authenticate(user)
            download = self.client.get(url)
            self.assertEqual(download.status_code, 200)
            self.assertEqual(b"".join(download.streaming_content), b"%PDF-1.4\nCV test")
        other = User.objects.create_user(email="other@example.com", role="recruiter")
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).status_code, 401)

    def test_reuse_preserves_original_when_profile_changes(self):
        self.candidate.cv = self.pdf()
        self.candidate.save()
        original = self.candidate.cv.name
        response = self.apply(use_saved_cv="true")
        self.assertEqual(response.status_code, 201, response.data)
        self.candidate.cv = self.pdf("new.pdf")
        self.candidate.save()
        self.assertEqual(Application.objects.get().cv.name, original)

    def test_missing_saved_cv_and_conflicting_choices(self):
        self.assertEqual(self.apply(use_saved_cv="true").status_code, 400)
        self.assertEqual(self.apply(use_saved_cv="true", cv=self.pdf()).status_code, 400)
        self.assertFalse(Application.objects.exists())

    def test_invalid_and_oversize_files(self):
        for file in (self.pdf("resume.txt"), SimpleUploadedFile("fake.pdf", b"invalid"),
                     SimpleUploadedFile("big.pdf", b"%PDF-" + b"x" * (5 * 1024 * 1024))):
            self.assertEqual(self.apply(cv=file).status_code, 400)
        self.assertFalse(Application.objects.exists())

    def test_without_cv_and_duplicate(self):
        self.assertEqual(self.apply().status_code, 201)
        self.assertFalse(Application.objects.get().cv)
        self.assertEqual(self.apply(cv=self.pdf()).status_code, 400)
        self.candidate.refresh_from_db()
        self.assertFalse(self.candidate.cv)


class ApplicationStatusTests(APITestCase):
    def setUp(self):
        self.recruiter = User.objects.create_user(email="rh@example.com", password="test", role="recruiter")
        self.candidate = User.objects.create_user(email="cand@example.com", password="test")
        company = Company.objects.create(name="Company", siret="12345678901234")
        category = Category.objects.create(name="IT", slug="it")
        ad = Ad.objects.create(title="Dev", company=company, recruiter=self.recruiter,
                               category=category, contract_type="CDI")
        self.application = Application.objects.create(candidate=self.candidate, ad=ad, message="Bonjour")
        self.url = f"/api/applications/{self.application.pk}/status"

    def test_recruiter_can_change_status(self):
        self.client.force_authenticate(self.recruiter)
        response = self.client.patch(self.url, {"status": "interview"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, "interview")
    
    def test_candidate_cannot_change_status(self):
        self.client.force_authenticate(self.candidate)
        response = self.client.patch(self.url, {"status": "accepted"}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_invalid_status_is_rejected(self):
        self.client.force_authenticate(self.recruiter)
        response = self.client.patch(self.url, {"status": "nimportequoi"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_other_recruiter_gets_404(self):
        other = User.objects.create_user(email="autre@example.com", password="test", role="recruiter")
        self.client.force_authenticate(other)
        response = self.client.patch(self.url, {"status": "accepted"}, format="json")
        self.assertEqual(response.status_code, 404)

class MessageReadTests(APITestCase):
    def setUp(self):
        self.recruiter = User.objects.create_user(email="rh@example.com", password="test", role="recruiter")
        self.candidate = User.objects.create_user(email="cand@example.com", password="test")
        company = Company.objects.create(name="Company", siret="12345678901234")
        category = Category.objects.create(name="IT", slug="it")
        ad = Ad.objects.create(title="Dev", company=company, recruiter=self.recruiter,
                               category=category, contract_type="CDI")
        self.message = Message.objects.create(candidate=self.candidate, ad=ad,
                                              object="Candidature : Dev", content="Bonjour")
        self.url = f"/api/messages/{self.message.pk}/read"

    def test_recruiter_can_mark_message_read(self):
        self.client.force_authenticate(self.recruiter)
        response = self.client.patch(self.url)
        self.assertEqual(response.status_code, 200)
        self.message.refresh_from_db()
        self.assertEqual(self.message.status, "read")

    def test_candidate_cannot_mark_message_read(self):
        self.client.force_authenticate(self.candidate)
        response = self.client.patch(self.url)
        self.assertEqual(response.status_code, 403)

    def test_other_recruiter_gets_404(self):
        other = User.objects.create_user(email="autre@example.com", password="test", role="recruiter")
        self.client.force_authenticate(other)
        response = self.client.patch(self.url)
        self.assertEqual(response.status_code, 404)

class AdSearchTests(APITestCase):
    def setUp(self):
        recruiter = User.objects.create_user(email="rh@example.com", password="test", role="recruiter")
        company = Company.objects.create(name="Company", siret="12345678901234")
        category = Category.objects.create(name="IT", slug="it")
        Ad.objects.create(title="Dev Python", short_description="Poste de dev",
                          company=company, recruiter=recruiter, category=category, contract_type="CDI")
        Ad.objects.create(title="Comptable", short_description="Gestion des comptes",
                          company=company, recruiter=recruiter, category=category, contract_type="CDI")

    def test_search_finds_matching_ad(self):
        response = self.client.get("/api/ads?search=python")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["title"], "Dev Python")

    def test_search_looks_in_description(self):
        response = self.client.get("/api/ads?search=gestion")
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["title"], "Comptable")

    def test_search_without_result_returns_empty_list(self):
        response = self.client.get("/api/ads?search=zzzz")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"], [])

class AdminApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email="admin@example.com", role="admin")
        self.candidate = User.objects.create_user(email="candidate@example.com", role="candidate")
        Company.objects.create(name="Danone", siret="11111111111111")
        Company.objects.create(name="Ubisoft", siret="22222222222222")

    def test_anonymous_is_refused(self):
        self.assertEqual(self.client.get("/api/admin/companies").status_code, 401)

    def test_non_admin_is_refused(self):
        self.client.force_authenticate(self.candidate)
        self.assertEqual(self.client.get("/api/admin/companies").status_code, 403)

    def test_admin_lists_with_pagination(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/admin/companies?page_size=1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertIsNotNone(response.data["next"])

    def test_admin_creates_updates_deletes(self):
        self.client.force_authenticate(self.admin)
        data = {"name": "Nouvelle", "siret": "33333333333333", "city": "Lyon", "postal_code": "69000"}
        created = self.client.post("/api/admin/companies", data, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        url = f"/api/admin/companies/{created.data['id']}"
        self.assertEqual(self.client.patch(url, {"city": "Paris"}, format="json").status_code, 200)
        self.assertEqual(Company.objects.get(pk=created.data["id"]).city, "Paris")
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertFalse(Company.objects.filter(pk=created.data["id"]).exists())

    def test_admin_cannot_delete_company_with_ads(self):
        self.client.force_authenticate(self.admin)
        company = Company.objects.get(name="Danone")
        recruiter = User.objects.create_user(email="rh@example.com", role="recruiter")
        category = Category.objects.create(name="IT", slug="it")
        Ad.objects.create(title="Dev Python", short_description="Poste de dev",
                          company=company, recruiter=recruiter, category=category, contract_type="CDI")
        response = self.client.delete(f"/api/admin/companies/{company.id}")
        self.assertEqual(response.status_code, 409)
        self.assertTrue(Company.objects.filter(pk=company.id).exists())

    def test_user_password_is_hidden_and_hashed(self):
        self.client.force_authenticate(self.admin)
        data = {"email": "new@example.com", "password": "motdepasse123", "role": "candidate",
                "city": "Nice", "postal_code": "06000"}
        response = self.client.post("/api/admin/users", data, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotIn("password", response.data)
        self.assertTrue(User.objects.get(email="new@example.com").check_password("motdepasse123"))

class ProfileApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="ana@test.fr", password="Motdepasse123", role="candidate",
            first_name="Ana", last_name="Roy", city="Lyon", postal_code="69000")
        User.objects.create_user(
            email="bob@test.fr", password="Motdepasse123", role="candidate",
            first_name="Bob", last_name="Lee", city="Nice", postal_code="06000")

    def test_anonymous_gets_401(self):
        r = self.client.patch("/api/auth/me", {"city": "Paris"}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_update_profile(self):
        self.client.force_authenticate(self.user)
        r = self.client.patch("/api/auth/me", {"city": "Paris", "first_name": "Anna"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["city"], "Paris")
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Anna")

    def test_cannot_change_role(self):
        self.client.force_authenticate(self.user)
        self.client.patch("/api/auth/me", {"role": "admin"}, format="json")
        self.user.refresh_from_db()
        self.assertEqual(self.user.role, "candidate")

    def test_cannot_change_email(self):
        self.client.force_authenticate(self.user)
        r = self.client.patch("/api/auth/me", {"email": "bob@test.fr"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertNotEqual(self.user.email, "bob@test.fr")

    def test_password_needs_current(self):
        self.client.force_authenticate(self.user)
        r = self.client.patch("/api/auth/me", {"password": "Nouveau12345678"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_password_change(self):
        self.client.force_authenticate(self.user)
        r = self.client.patch("/api/auth/me", {"current_password": "Motdepasse123",
                              "password": "Nouveau12345678"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Nouveau12345678"))

class PasswordResetTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="ana@test.fr", password="Motdepasse123", role="candidate")

    def test_forgot_sends_mail(self):
        r = self.client.post("/api/auth/forgot-password", {"email": "ana@test.fr"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

    def test_forgot_unknown_email_same_answer(self):
        r = self.client.post("/api/auth/forgot-password", {"email": "inconnu@test.fr"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_reset_changes_password(self):
        token = make_token(self.user)
        r = self.client.post("/api/auth/reset-password",
                             {"token": token, "password": "Nouveau12345678"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Nouveau12345678"))

    def test_link_works_only_once(self):
        token = make_token(self.user)
        self.client.post("/api/auth/reset-password",
                         {"token": token, "password": "Nouveau12345678"}, format="json")
        r = self.client.post("/api/auth/reset-password",
                             {"token": token, "password": "Autre123456789"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_weak_password_rejected(self):
        token = make_token(self.user)
        r = self.client.post("/api/auth/reset-password",
                             {"token": token, "password": "abc"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_invalid_token_rejected(self):
        r = self.client.post("/api/auth/reset-password",
                             {"token": "n-importe-quoi", "password": "Nouveau12345678"}, format="json")
        self.assertEqual(r.status_code, 400)
   
    def test_short_password_rejected(self):
        token = make_token(self.user)
        r = self.client.post("/api/auth/reset-password",
                             {"token": token, "password": "abc123"}, format="json")
        self.assertEqual(r.status_code, 400)

class ChangePasswordTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="ana@test.fr", password="Motdepasse123", role="candidate")

    def test_anonymous_gets_401(self):
        r = self.client.post("/api/auth/password",
                             {"old_password": "Motdepasse123", "new_password": "Nouveau12345678"}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_change_password(self):
        self.client.force_authenticate(self.user)
        r = self.client.post("/api/auth/password",
                             {"old_password": "Motdepasse123", "new_password": "Nouveau12345678"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Nouveau12345678"))

    def test_wrong_old_password(self):
        self.client.force_authenticate(self.user)
        r = self.client.post("/api/auth/password",
                             {"old_password": "FauxMotdepasse1", "new_password": "Nouveau12345678"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Motdepasse123"))

    def test_weak_new_password(self):
        self.client.force_authenticate(self.user)
        r = self.client.post("/api/auth/password",
                             {"old_password": "Motdepasse123", "new_password": "abc123"}, format="json")
        self.assertEqual(r.status_code, 400)

class CandidateApplicationDetailTests(APITestCase):
    def setUp(self):
        self.candidate = User.objects.create_user(email="candidate@example.com", password="test")
        self.other = User.objects.create_user(email="other@example.com", password="test")
        recruiter = User.objects.create_user(email="recruiter@example.com", role="recruiter")
        company = Company.objects.create(name="Company", siret="12345678901234")
        category = Category.objects.create(name="IT", slug="it")
        ad = Ad.objects.create(title="Dev", company=company, recruiter=recruiter,
                               category=category, contract_type="CDI")
        self.application = Application.objects.create(
            candidate=self.candidate, ad=ad, first_name="Jane", last_name="Doe",
            email="candidate@example.com", message="Bonjour")
        self.url = f"/api/candidate/applications/{self.application.pk}"
        self.client.force_authenticate(self.candidate)

    def test_candidate_can_edit_message(self):
        response = self.client.patch(self.url, {"message": "Nouveau message"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.application.refresh_from_db()
        self.assertEqual(self.application.message, "Nouveau message")

    def test_candidate_cannot_change_status(self):
        self.client.patch(self.url, {"status": "accepted"}, format="json")
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, "sent")

    def test_other_candidate_gets_404(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.patch(self.url, {"message": "Piraté"}, format="json").status_code, 404)
        self.assertEqual(self.client.delete(self.url).status_code, 404)
        self.assertTrue(Application.objects.filter(pk=self.application.pk).exists())

    def test_anonymous_gets_401(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.patch(self.url, {"message": "x"}, format="json").status_code, 401)
        self.assertEqual(self.client.delete(self.url).status_code, 401)

    def test_closed_application_cannot_be_edited_or_withdrawn(self):
        for status in ("accepted", "rejected"):
            self.application.status = status
            self.application.save()
            self.assertEqual(self.client.patch(self.url, {"message": "x"}, format="json").status_code, 400)
            self.assertEqual(self.client.delete(self.url).status_code, 400)
        self.assertTrue(Application.objects.filter(pk=self.application.pk).exists())

    def test_candidate_can_withdraw(self):
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Application.objects.filter(pk=self.application.pk).exists())

class DeleteAccountTests(APITestCase):
    def setUp(self):
        self.candidate = User.objects.create_user(email="candidate@example.com", password="test")
        self.other = User.objects.create_user(email="other@example.com", password="test")
        self.recruiter = User.objects.create_user(email="recruiter@example.com", role="recruiter")
        company = Company.objects.create(name="Company", siret="12345678901234")
        category = Category.objects.create(name="IT", slug="it")
        ad = Ad.objects.create(title="Dev", company=company, recruiter=self.recruiter,
                               category=category, contract_type="CDI")
        Application.objects.create(candidate=self.candidate, ad=ad, first_name="Jane",
                                   last_name="Doe", email="candidate@example.com", message="Bonjour")
        self.client.force_authenticate(self.candidate)

    def test_anonymous_gets_401(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.delete("/api/auth/me").status_code, 401)
        self.assertEqual(User.objects.count(), 3)

    def test_candidate_deletes_own_account_and_applications(self):
        response = self.client.delete("/api/auth/me")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(User.objects.filter(email="candidate@example.com").exists())
        self.assertFalse(Application.objects.exists())
        self.assertTrue(User.objects.filter(email="other@example.com").exists())

    def test_recruiter_deletion_removes_his_ads_but_keeps_company(self):
        self.client.force_authenticate(self.recruiter)
        self.assertEqual(self.client.delete("/api/auth/me").status_code, 204)
        self.assertFalse(Ad.objects.exists())
        self.assertTrue(Company.objects.exists())

class ProfileFieldsTests(APITestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        override = override_settings(MEDIA_ROOT=directory.name)
        override.enable()
        self.addCleanup(override.disable)
        self.company = Company.objects.create(name="Acme", siret="12345678901234", city="Lyon",
                                              postal_code="69000", description="Super", website="https://acme.fr")
        self.candidate = User.objects.create_user(email="candidate@example.com", password="test")
        self.recruiter = User.objects.create_user(email="recruiter@example.com", password="test",
                                                  role="recruiter", company=self.company)

    def pdf(self, name="resume.pdf"):
        return SimpleUploadedFile(name, b"%PDF-1.4\nCV test", content_type="application/pdf")

    def test_get_returns_cv_name(self):
        self.client.force_authenticate(self.candidate)
        self.assertIsNone(self.client.get("/api/auth/me").data["cv"])
        self.candidate.cv = self.pdf()
        self.candidate.save()
        self.assertEqual(self.client.get("/api/auth/me").data["cv"], "resume.pdf")

    def test_get_returns_company_fields_for_recruiter(self):
        self.client.force_authenticate(self.recruiter)
        data = self.client.get("/api/auth/me").data
        self.assertEqual(data["company_name"], "Acme")
        self.assertEqual(data["siret"], "12345678901234")
        self.assertEqual(data["company_city"], "Lyon")
        self.assertEqual(data["company_postal_code"], "69000")
        self.assertEqual(data["website"], "https://acme.fr")
        self.client.force_authenticate(self.candidate)
        self.assertNotIn("company_name", self.client.get("/api/auth/me").data)
    def test_patch_saves_cv(self):
        self.client.force_authenticate(self.candidate)
        response = self.client.patch("/api/auth/me", {"cv": self.pdf()}, format="multipart")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["cv"], "resume.pdf")
        self.candidate.refresh_from_db()
        self.assertTrue(self.candidate.cv)

    def test_patch_rejects_bad_cv(self):
        self.client.force_authenticate(self.candidate)
        for file in (self.pdf("resume.txt"), SimpleUploadedFile("fake.pdf", b"invalid"),
                     SimpleUploadedFile("big.pdf", b"%PDF-" + b"x" * (5 * 1024 * 1024))):
            response = self.client.patch("/api/auth/me", {"cv": file}, format="multipart")
            self.assertEqual(response.status_code, 400)
        self.candidate.refresh_from_db()
        self.assertFalse(self.candidate.cv)
    def test_recruiter_updates_company(self):
        self.client.force_authenticate(self.recruiter)
        response = self.client.patch("/api/auth/me", {"company_name": "Acme 2", "company_city": "Paris",
                                                      "website": ""}, format="multipart")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["company_name"], "Acme 2")
        self.company.refresh_from_db()
        self.assertEqual(self.company.name, "Acme 2")
        self.assertEqual(self.company.city, "Paris")
        self.assertEqual(self.company.website, "")

    def test_invalid_or_taken_siret(self):
        Company.objects.create(name="Other", siret="98765432109876", city="Nice", postal_code="06000")
        self.client.force_authenticate(self.recruiter)
        for siret in ("123", "1234567890123a", "98765432109876"):
            response = self.client.patch("/api/auth/me", {"siret": siret}, format="multipart")
            self.assertEqual(response.status_code, 400, siret)
        self.company.refresh_from_db()
        self.assertEqual(self.company.siret, "12345678901234")

    def test_candidate_cannot_edit_company(self):
        self.client.force_authenticate(self.candidate)
        response = self.client.patch("/api/auth/me", {"company_name": "Hack"}, format="multipart")
        self.assertEqual(response.status_code, 400)

class MyAdsTests(APITestCase):
    def setUp(self):
        self.recruiter = User.objects.create_user(email="rh@example.com", password="test", role="recruiter")
        other = User.objects.create_user(email="rh2@example.com", password="test", role="recruiter")
        self.candidate = User.objects.create_user(email="candidate@example.com", password="test")
        company = Company.objects.create(name="Company", siret="12345678901234")
        category = Category.objects.create(name="IT", slug="it")
        self.closed = Ad.objects.create(title="Fermée", company=company, recruiter=self.recruiter,
                                        category=category, contract_type="CDI", status="closed")
        Ad.objects.create(title="Ouverte", company=company, recruiter=self.recruiter,
                          category=category, contract_type="CDI")
        Ad.objects.create(title="Autre", company=company, recruiter=other,
                          category=category, contract_type="CDI")

    def titles(self, response):
        # la liste publique est paginée ({"results": [...]}), "mine" renvoie une liste simple
        data = response.data["results"] if isinstance(response.data, dict) else response.data
        return {ad["title"] for ad in data}

    def test_mine_returns_own_open_and_closed_ads(self):
        self.client.force_authenticate(self.recruiter)
        response = self.client.get("/api/ads?mine=true")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.titles(response), {"Ouverte", "Fermée"})

    def test_public_list_hides_closed_ads(self):
        response = self.client.get("/api/ads")
        self.assertEqual(self.titles(response), {"Ouverte", "Autre"})

    def test_mine_is_refused_to_candidate_and_anonymous(self):
        self.client.force_authenticate(self.candidate)
        self.assertEqual(self.client.get("/api/ads?mine=true").status_code, 403)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get("/api/ads?mine=true").status_code, (401, 403))

    def test_closed_ad_detail_is_hidden_from_public(self):
        self.assertEqual(self.client.get(f"/api/ads/{self.closed.pk}").status_code, 404)

    def test_recruiter_reopens_own_closed_ad(self):
        self.client.force_authenticate(self.recruiter)
        response = self.client.post(f"/api/ads/{self.closed.pk}/reopen")
        self.assertEqual(response.status_code, 200)
        self.closed.refresh_from_db()
        self.assertEqual(self.closed.status, "open")

    def test_reopen_refused_to_other_recruiter_and_candidate(self):
        other = User.objects.get(email="rh2@example.com")
        self.client.force_authenticate(other)
        self.assertEqual(self.client.post(f"/api/ads/{self.closed.pk}/reopen").status_code, 404)
        self.client.force_authenticate(self.candidate)
        self.assertEqual(self.client.post(f"/api/ads/{self.closed.pk}/reopen").status_code, 403)