/* =========================================================
   admin.js — admin panel logic (admin.html)
   ========================================================= */

let pendingDeleteId = null;

document.addEventListener('DOMContentLoaded', () => {
  const admin = requireAdmin('index.html');
  if (!admin) return;

  renderNavbar();
  renderStats();
  renderProductsTable();
  renderOrdersTable();
  setupTabs();
  setupProductModal();
  setupDeleteModal();
});

/* ---------- Stats ---------- */
function renderStats() {
  const products = ProductDB.getAll();
  const orders = OrderDB.getAll();
  const users = UserDB.getAll();
  const revenue = orders.reduce((sum, o) => sum + o.total, 0);

  document.getElementById('statProducts').textContent = products.length;
  document.getElementById('statOrders').textContent = orders.length;
  document.getElementById('statRevenue').textContent = formatPrice(revenue);
  document.getElementById('statUsers').textContent = users.length;
}

/* ---------- Tabs ---------- */
function setupTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.getElementById('tabProducts').style.display = target === 'products' ? 'block' : 'none';
      document.getElementById('tabOrders').style.display = target === 'orders' ? 'block' : 'none';
    });
  });
}

/* ---------- Products table ---------- */
function renderProductsTable() {
  const products = ProductDB.getAll();
  const tbody = document.getElementById('productsTableBody');

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">No products yet. Add your first one.</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td><img class="thumb-sm" src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}"
            onerror="this.src='https://via.placeholder.com/60x60?text=No+Img'"></td>
      <td>${escapeHTML(p.name)}</td>
      <td>${escapeHTML(p.category || '—')}</td>
      <td>${formatPrice(p.price)}</td>
      <td>${p.stock}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm" data-edit="${p.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-delete="${p.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openProductModal(btn.dataset.edit));
  });
  tbody.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.delete));
  });
}

/* ---------- Orders table ---------- */
function renderOrdersTable() {
  const orders = [...OrderDB.getAll()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const users = UserDB.getAll();
  const tbody = document.getElementById('ordersTableBody');

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">No orders placed yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => {
    const user = users.find(u => u.id === o.userId);
    const itemsLabel = o.items.map(i => `${i.name} ×${i.qty}`).join(', ');
    const date = new Date(o.createdAt).toLocaleString();
    return `
      <tr>
        <td style="font-family:monospace; font-size:0.78rem;">${escapeHTML(o.id)}</td>
        <td>${escapeHTML(user ? user.name : 'Unknown')}</td>
        <td style="max-width:260px;">${escapeHTML(itemsLabel)}</td>
        <td>${formatPrice(o.total)}</td>
        <td>${escapeHTML(date)}</td>
        <td><span class="stock-pill stock-ok">${escapeHTML(o.status)}</span></td>
      </tr>
    `;
  }).join('');
}

/* ---------- Product Add/Edit Modal ---------- */
function setupProductModal() {
  const modal = document.getElementById('productModal');
  const form = document.getElementById('productForm');
  const addBtn = document.getElementById('addProductBtn');
  const cancelBtn = document.getElementById('cancelModalBtn');

  addBtn.addEventListener('click', () => openProductModal(null));
  cancelBtn.addEventListener('click', () => closeModal(modal));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveProduct();
  });
}

function openProductModal(productId) {
  const modal = document.getElementById('productModal');
  const errorBox = document.getElementById('modalError');
  errorBox.classList.remove('show');

  if (productId) {
    const p = ProductDB.getById(productId);
    document.getElementById('modalTitle').textContent = 'Edit Product';
    document.getElementById('productId').value = p.id;
    document.getElementById('prodName').value = p.name;
    document.getElementById('prodDescription').value = p.description;
    document.getElementById('prodPrice').value = p.price;
    document.getElementById('prodStock').value = p.stock;
    document.getElementById('prodCategory').value = p.category;
    document.getElementById('prodImage').value = p.image;
  } else {
    document.getElementById('modalTitle').textContent = 'Add Product';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
  }

  openModal(modal);
}

function saveProduct() {
  const errorBox = document.getElementById('modalError');
  const id = document.getElementById('productId').value;

  const name = document.getElementById('prodName').value.trim();
  const description = document.getElementById('prodDescription').value.trim();
  const price = parseFloat(document.getElementById('prodPrice').value);
  const stock = parseInt(document.getElementById('prodStock').value, 10);
  const category = document.getElementById('prodCategory').value.trim();
  const image = document.getElementById('prodImage').value.trim();

  if (!name || !description || !category || !image || isNaN(price) || isNaN(stock)) {
    errorBox.textContent = 'Please fill in all fields with valid values.';
    errorBox.classList.add('show');
    return;
  }
  if (price < 0 || stock < 0) {
    errorBox.textContent = 'Price and stock cannot be negative.';
    errorBox.classList.add('show');
    return;
  }

  const payload = { name, description, price, stock, category, image };

  try {
    if (id) {
      ProductDB.update(id, payload);
      showToast('Product updated successfully.');
    } else {
      ProductDB.create(payload);
      showToast('Product added successfully.');
    }
    closeModal(document.getElementById('productModal'));
    renderProductsTable();
    renderStats();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('show');
  }
}

/* ---------- Delete Modal ---------- */
function setupDeleteModal() {
  const modal = document.getElementById('deleteModal');
  document.getElementById('cancelDeleteBtn').addEventListener('click', () => closeModal(modal));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });

  document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
    if (!pendingDeleteId) return;
    ProductDB.delete(pendingDeleteId);
    showToast('Product deleted.');
    closeModal(modal);
    renderProductsTable();
    renderStats();
    pendingDeleteId = null;
  });
}

function openDeleteModal(productId) {
  const product = ProductDB.getById(productId);
  if (!product) return;
  pendingDeleteId = productId;
  document.getElementById('deleteProductName').textContent = product.name;
  openModal(document.getElementById('deleteModal'));
}

/* ---------- Modal helpers ---------- */
function openModal(modal) { modal.classList.add('open'); }
function closeModal(modal) { modal.classList.remove('open'); }
