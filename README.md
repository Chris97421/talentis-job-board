# Job Board: Talentis

Epitech T-WEB-501 project: a job listing website (branded "Talentis").

- **Back-end**: Django 5.2 + Django REST Framework + MySQL 8, all running in Docker.
- **Front-end**: HTML, CSS and JavaScript (no framework), served by nginx.
- The browser loads an HTML page. The page's JavaScript calls the API
  (`fetch`) with a token, then displays the JSON response without reloading the page.

## Run the project with Docker

Prerequisites: Docker and Docker Compose installed.

1. Copy the settings template: `cp .env.example .env`
2. Open `.env` and replace the `change-me` values with your own
   (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `SECRET_KEY`, `MYSQL_ROOT_PASSWORD`).
   The `.env` file is never pushed to GitHub.
3. Start the project: `docker compose up -d --build`
   (the tables are created automatically when the back-end starts)
4. Fill the database (only once): `docker compose exec backend python manage.py seed`
   This command creates the 16 categories, companies, job ads and demo accounts.
   It can be re-run without creating duplicates.
   To reset the demo data (statuses, applications, original names):
   `docker compose exec backend python manage.py seed_demo --reset`.
   This command only deletes the demo data, not other accounts.

Addresses:
- API: http://localhost:8000/api/
- Front-end: http://localhost:5500/main.html

Stop: `docker compose stop` (data is kept).
Start again from an empty database: `docker compose down -v` (after a `down -v`, redo step 4).

If the back-end stops with `Access denied for user`, the database was created with old
credentials (for example an empty `.env`): run `docker compose down -v` and start again.

## Demo accounts

Password for all accounts: `motdepasse123`

| Role | Email |
|---|---|
| Candidate | `lea.martin@example.com` |
| Recruiter | `recruiter.decathlon@example.com` |
| Administrator | `admin@example.com` |

Passwords are stored hashed. These accounts are for demonstration only.
After a successful login, an administrator is sent to `espace-admin.html`,
a recruiter to their recruiter area, and a candidate to the job listings page.

## Database schema

MySQL database, 6 tables (the `id` fields are created automatically by Django).

| Table | Main fields | Links |
|---|---|---|
| `User` | email (unique, used as login), hashed password, first_name, last_name, telephone, city, postal_code, role (`candidate`, `recruiter` or `admin`), cv | `company` → Company (optional, for a recruiter) |
| `Company` | name, siret (14 characters, unique), description, website, city, postal_code | |
| `Category` | name (unique), slug (unique) | |
| `Ad` (job ad) | title, short_description, full_description, city, contract_type, monthly_salary_min / max, working_time, education_level, experience, work_mode, start_time, status (`open` or `closed`) | `company` → Company, `recruiter` → User, `category` → Category |
| `Application` | first_name, last_name, email, telephone, cv, message, status (`sent`, `seen`, `interview`, `rejected`, `accepted`) | `candidate` → User, `ad` → Ad |
| `Message` | object, content, sent_at, status (`unread` or `read`) | `candidate` → User, `ad` → Ad |

Key relations:
- A candidate can apply **only once** per job ad (`unique_candidate_ad` constraint).
- Deleting a user deletes their applications, messages and job ads (`CASCADE`).
- A company or a category cannot be deleted while job ads are linked to it (`PROTECT`).
- If a company is deleted, the recruiters attached to it keep their account (`SET_NULL`).

## API routes

All routes start with `/api/`.
Routes marked "logged in" require the header `Authorization: Bearer YOUR_TOKEN`.
Validation error messages are returned in French, field by field (400 status code).

### Accounts
| Method | Route | Who | Purpose |
|---|---|---|---|
| POST | `auth/register` | everyone | Create a candidate or recruiter account |
| POST | `auth/login` | everyone | Log in, returns a token |
| GET | `auth/me` | logged in | Full profile (CV, and company for a recruiter) |
| PATCH | `auth/me` | logged in | Update profile, CV (PDF, 5 MB max) and company |
| DELETE | `auth/me` | logged in | Delete your account (your applications, messages and job ads are deleted with it) |
| POST | `auth/logout` | logged in | Log out |
| POST | `auth/password` | logged in | Change password (`old_password`, `new_password`) |
| POST | `auth/forgot-password` | everyone | Request a password reset link by email |
| POST | `auth/reset-password` | everyone | Choose a new password with the received link (`token`, `password`) |

Password rule: at least 12 characters, with at least one letter and one digit.

Password reset: in development, the email is not actually sent, it is printed in the logs:
`docker compose logs backend`. The link can only be used once.

### Job ads
| Method | Route | Who | Purpose |
|---|---|---|---|
| GET | `categories` | everyone | List of categories (id, name, slug) |
| GET | `ads` | everyone | List of open job ads. Filters: `search`, `city`, `contract_type`, `working_time`, `education_level`, `experience`, `work_mode`, `category` (e.g. `ads?search=python&city=Paris`) |
| GET | `ads?mine=true` | recruiter | All my job ads, open and closed |
| GET | `ads/<id>` | everyone | Details of an open job ad |
| POST | `ads` | recruiter | Create a job ad (`category` = the category id) |
| PUT / PATCH | `ads/<id>` | owner recruiter | Update a job ad |
| DELETE | `ads/<id>` | owner recruiter | Close a job ad (it is not erased) |

### Applications and messages
| Method | Route | Who | Purpose |
|---|---|---|---|
| POST | `ads/<id>/apply` | candidate | Apply to a job ad (only once per ad, optional PDF CV) |
| GET | `candidate/applications` | candidate | My applications |
| PATCH | `candidate/applications/<id>` | owner candidate | Edit your application (not possible if accepted or rejected) |
| DELETE | `candidate/applications/<id>` | owner candidate | Withdraw your application (not possible if accepted or rejected) |
| GET | `recruiter/applications` | recruiter | Applications received on my job ads |
| PATCH | `applications/<id>/status` | recruiter | Change the status (sent, seen, interview, rejected, accepted) |
| GET | `applications/<id>/cv` | candidate or recruiter concerned | Download the CV |
| POST | `ads/<id>/messages` | candidate | Write to the recruiter |
| GET | `ads/<id>/messages` | logged in | Messages of a job ad (the recruiter sees all messages of their ad, the candidate sees their own) |
| PATCH | `messages/<id>/read` | recruiter | Mark a message as read |

### Administration
The routes `admin/companies`, `admin/categories`, `admin/ads`, `admin/applications`,
`admin/messages` and `admin/users` are reserved for administrator accounts.
Each one provides full CRUD:

| Method | Route | Purpose |
|---|---|---|
| GET | `admin/<table>` | List (paginated) |
| POST | `admin/<table>` | Create |
| GET | `admin/<table>/<id>` | Details |
| PATCH / PUT | `admin/<table>/<id>` | Update |
| DELETE | `admin/<table>/<id>` | Delete |

Other accounts receive 403, visitors who are not logged in receive 401.

Pagination: 10 items per page by default. `?page=2` selects the page,
`?page_size=50` changes the size (100 maximum). The response contains
`count`, `next`, `previous` and `results`.
For users, `?search=` searches the email, first name and last name,
and `?role=candidate|recruiter|admin` filters by role.

## Front-end pages

All pages are in `front-end/` and use `js/api.js`
(API calls with the token, automatic logout if the token is rejected).

| Page | Purpose |
|---|---|
| `main.html` | Job ad list, filters, "Learn more" (details shown without reloading) and "Apply" form |
| `login.html` | Login, and "forgot password" link request |
| `account.html` | Account creation (candidate or recruiter) |
| `profile.html` | Edit your profile, CV and password |
| `reset-password.html` | Choose a new password with the received link |
| `espace-candidate.html` | Candidate area: my applications and my messages |
| `espace-recruiter.html` | Recruiter area: my job ads, received applications and messages |
| `espace-admin.html` | Administrator area: a single page with 6 sections (menu on the left): dashboard, users, companies, job ads, applications, messages |

`espace-admin.html` is only displayed for an administrator account.
Other users are redirected to the login page. The administration details are in the next section.

## Administration interface

`espace-admin.html` calls the `admin/...` API routes. Each section has its own JavaScript file
(`js/admin-*.js`) and the `js/admin-common.js` file contains the shared parts
(form windows, confirmation and error messages, list loading).

| Section | What the administrator can do |
|---|---|
| Dashboard | See the real figures (users, companies, open job ads, applications) and the latest records |
| Users | Search (last name, first name, email), filter by role, pagination, **add**, **edit**, **delete** |
| Companies | Search, pagination, **add**, **edit**, **delete** |
| Job ads | Search, filter by status, **add** (by choosing the company, recruiter and category), **edit**, close or reopen, **delete** |
| Applications | Filter by status, change the status, **delete** |
| Messages | Search, **delete** |

Safeguards:
- An administrator cannot delete their own account, nor remove their own administrator role.
- Deleting a company that still has job ads is refused by the API (409 error): a message explains why.
- Deleting a job ad also deletes its applications (after confirmation).

## Run the tests

```
docker compose exec backend python manage.py test
```

The test suite contains 60 tests (accounts, job ads, applications, administration, access rights).

On first run, MySQL may refuse to create the test database
(`Access denied ... test_jobboard_db`). You then need to grant the right to
`jobboard_user` (to redo after each `docker compose down -v`):

```
docker compose exec db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "GRANT ALL PRIVILEGES ON test_jobboard_db.* TO \"jobboard_user\"@\"%\";"'
```

## Repository layout

```
back-end/     Django (api/models.py, api/views.py, api/admin_api.py, api/serializers.py, api/tests.py)
front-end/    HTML pages, js/ (one file per page), style/ (CSS)
docker-compose.yml   3 services: db (MySQL), backend (Django), frontend (nginx)
.env.example  settings template (copy to .env)
```

## Team
Project built by a team of 3 at Epitech: Christophe Malet (back-end / API, Docker), [@mengqichenn](https://github.com/mengqichenn) and [@majjoutmeryam6-source](https://github.com/majjoutmeryam6-source).
