(function () {
  const btn = document.querySelector('.login');
  if (!btn) return;
  fetch('/api/me', { credentials: 'same-origin' })
    .then(r => r.ok ? r.json() : null)
    .then(user => {
      if (user) {
        btn.href = '/cabinet';
        btn.innerHTML = '<span class="user-icon"></span><span>ПРОФИЛЬ</span>';
      } else {
        btn.href = '/login.html';
        btn.innerHTML = '<span class="user-icon"></span><span>ВОЙТИ</span>';
      }
      btn.style.visibility = 'visible';
    })
    .catch(() => {
      btn.style.visibility = 'visible';
    });
})();