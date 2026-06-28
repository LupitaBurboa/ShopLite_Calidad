/* =========================================================
   store.js — storefront page logic (index.html)
   ========================================================= */

let allProducts = [];
let currentFilters = { search: '', category: '', sort: 'default' };

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  allProducts = ProductDB.getAll();
  populateCategoryFilter();
  renderProducts();

  document.getElementById('searchInput').addEventListener('input', (e) => {
    currentFilters.search = e.target.value.trim().toLowerCase();
    renderProducts();
  });

  document.getElementById('categoryFilter').addEventListener('change', (e) => {
    currentFilters.category = e.target.value;
    renderProducts();
  });

  document.getElementById('sortSelect').addEventListener('change', (e) => {
    currentFilters.sort = e.target.value;
    renderProducts();
  });
});

function populateCategoryFilter() {
  const select = document.getElementById('categoryFilter');
  const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))].sort();
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

function getFilteredProducts() {
  let list = [...allProducts];

  if (currentFilters.search) {
    list = list.filter(p =>
      p.name.toLowerCase().includes(currentFilters.search) ||
      (p.description || '').toLowerCase().includes(currentFilters.search)
    );
  }

  if (currentFilters.category) {
    list = list.filter(p => p.category === currentFilters.category);
  }

  switch (currentFilters.sort) {
    case 'price-asc': list.sort((a, b) => a.price - b.price); break;
    case 'price-desc': list.sort((a, b) => b.price - a.price); break;
    case 'name-asc': list.sort((a, b) => a.name.localeCompare(b.name)); break;
    default: break;
  }

  return list;
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  const emptyState = document.getElementById('emptyState');
  const filtered = getFilteredProducts();

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  grid.innerHTML = filtered.map(p => productCardHTML(p)).join('');

  grid.querySelectorAll('[data-add-to-cart]').forEach(btn => {
    btn.addEventListener('click', () => handleAddToCart(btn.dataset.addToCart));
  });
}

function productCardHTML(p) {
  let stockLabel, stockClass;
  if (p.stock <= 0) { stockLabel = 'Out of stock'; stockClass = 'stock-out'; }
  else if (p.stock <= 5) { stockLabel = `Only ${p.stock} left`; stockClass = 'stock-low'; }
  else { stockLabel = 'In stock'; stockClass = 'stock-ok'; }

  return `
    <div class="product-card">
      <img class="product-thumb" src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}"
           onerror="this.src='https://via.placeholder.com/400x300?text=No+Image'">
      <div class="product-card-body">
        <span class="product-category">${escapeHTML(p.category || 'General')}</span>
        <h3 class="product-name">${escapeHTML(p.name)}</h3>
        <p class="product-desc">${escapeHTML(p.description || '')}</p>
        <div class="product-footer">
          <span class="product-price">${formatPrice(p.price)}</span>
          <span class="stock-pill ${stockClass}">${stockLabel}</span>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:10px;"
          data-add-to-cart="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>
          ${p.stock <= 0 ? 'Unavailable' : 'Add to Cart'}
        </button>
      </div>
    </div>
  `;
}

function handleAddToCart(productId) {
  const user = SessionDB.getCurrentUser();
  if (!user) {
    showToast('Please log in to add items to your cart.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 900);
    return;
  }

  const product = ProductDB.getById(productId);
  if (!product || product.stock <= 0) {
    showToast('This product is out of stock.', 'error');
    return;
  }

  CartDB.addItem(user.id, productId, 1);
  updateCartBadge();
  showToast(`${product.name} added to cart`);
}
