// Afficher le prénom, le nom et les initiales renvoyés par l’API.
function initMenu(me) {
  if (!me) return;
  const name = [me.first_name, me.last_name].filter(Boolean).join(' ').trim() || me.name || 'Mon compte';
  const parts = me.first_name && me.last_name ? [me.first_name.trim(), me.last_name.trim()] : name.split(/\s+/);
  const initials = parts.filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  document.querySelectorAll('.menu-initials').forEach(el => el.textContent = initials);
  document.querySelectorAll('.menu-name').forEach(el => el.textContent = name);   // textContent : pas de XSS

  document.querySelectorAll('.menu-profile').forEach(el => el.href = 'profile.html');
}

// Ces écouteurs ne sont installés qu’une fois, même si le nom change.
{
  const menus = document.querySelectorAll('.menu details');
  document.addEventListener('click', e => {
    menus.forEach(d => { if (!d.contains(e.target)) d.open = false; });           // clic ailleurs : ferme
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    menus.forEach(d => { if (d.open) { d.open = false; d.querySelector('summary').focus(); } });
  });
}

// Déconnexion : un bouton [data-logout] par menu (pas d'id, car il y a deux menus dans la page)
document.addEventListener('click', async e => {
  if (!e.target.closest('[data-logout]')) return;
  try { await api('/auth/logout', { method: 'POST', redirectOn401: false }); } catch {}
  localStorage.removeItem('token');
  location.href = 'main.html';
});

