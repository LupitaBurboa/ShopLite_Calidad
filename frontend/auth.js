/* =========================================================
   auth.js — shared auth helpers, route guards, navbar rendering
   ========================================================= */

async function requireLogin(redirectTo = 'login.html') {
  const user = await SessionDB.getCurrentUser();
  if (!user) {
    window.location.href = redirectTo;
    return null;
  }
  return user;
}

async function requireAdmin(redirectTo = 'index.html') {
  const user = await SessionDB.getCurrentUser();
  if (!user || user.role !== 'admin') {
    window.location.href = redirectTo;
    return null;
  }
  return user;
}

async function redirectIfLoggedIn(target = 'index.html') {
  const user = await SessionDB.getCurrentUser();
  if (user) {
    window.location.href = target;
  }
}

async function logoutUser() {
  await SessionDB.logout();
  window.location.href = 'index.html';
}

/* Renders the shared navbar auth area (#authArea) based on session state.
   Expects an element with id="authArea" and id="cartCount" (optional) on the page. */
async function renderNavbar() {
  const authArea = document.getElementById('authArea');
  if (!authArea) return;

  const user = await SessionDB.getCurrentUser();

  if (!user) {
    authArea.innerHTML = `
      <a href="login.html" class="nav-link">Login</a>
      <a href="register.html" class="nav-link btn-outline-small">Sign Up</a>
    `;
  } else {
    const adminLink = user.role === 'admin'
      ? `<a href="admin.html" class="nav-link">Admin Panel</a>`
      : '';
    authArea.innerHTML = `
      ${adminLink}
      <span class="nav-greeting">Hi, ${escapeHTML(user.name)}</span>
      <button id="logoutBtn" class="nav-link btn-outline-small">Logout</button>
    `;
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', logoutUser);
    }
  }

  await updateCartBadge();
}

async function updateCartBadge() {
  const badge = document.getElementById('cartCount');
  if (!badge) return;
  const user = await SessionDB.getCurrentUser();
  if (!user) {
    badge.textContent = '0';
    badge.style.display = 'none';
    return;
  }
  const items = await CartDB.getCart(user.id);
  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
  badge.textContent = String(totalQty);
  badge.style.display = totalQty > 0 ? 'inline-block' : 'none';
}

/* basic HTML escaping to avoid accidental injection from stored text fields */
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatPrice(num) {
  return `$${Number(num).toFixed(2)}`;
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add('toast-hide'), 2200);
  setTimeout(() => toast.remove(), 2600);
}
