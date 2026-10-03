/* =========================================================
   admin.js — admin panel logic (admin.html)
   ========================================================= */

let pendingDeleteId = null;
let pendingImagePreviewUrl = null;

document.addEventListener('DOMContentLoaded', async () => {
  const admin = await requireAdmin('index.html');
  if (!admin) return;

  await renderNavbar();
  await renderStats();
  await renderProductsTable();
  await renderOrdersTable();
  setupTabs();
  setupProductModal();
  setupDeleteModal();
});

/* ---------- Stats ---------- */
async function renderStats() {
  const [products, orders, users] = await Promise.all([
    ProductDB.getAll(), OrderDB.getAll(), UserDB.getAll()
  ]);
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
async function renderProductsTable() {
  const products = await ProductDB.getAll();
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
    btn.addEventListener('click', () => { void openProductModal(btn.dataset.edit); });
  });
  tbody.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => { void openDeleteModal(btn.dataset.delete); });
  });
}

/* ---------- Orders table ---------- */
async function renderOrdersTable() {
  const [orderRows, users] = await Promise.all([OrderDB.getAll(), UserDB.getAll()]);
  const orders = [...orderRows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
  const imageFileInput = document.getElementById('prodImageFile');

  addBtn.addEventListener('click', () => openProductModal(null));
  cancelBtn.addEventListener('click', () => closeModal(modal));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
  imageFileInput.addEventListener('change', () => {
    const file = imageFileInput.files[0];
    if (file) showProductImagePreview(URL.createObjectURL(file));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveProduct();
  });
}

async function openProductModal(productId) {
  const modal = document.getElementById('productModal');
  const errorBox = document.getElementById('modalError');
  errorBox.classList.remove('show');

  if (productId) {
    const p = await ProductDB.getById(productId);
    if (!p) return;
    document.getElementById('modalTitle').textContent = 'Edit Product';
    document.getElementById('productId').value = p.id;
    document.getElementById('prodName').value = p.name;
    document.getElementById('prodDescription').value = p.description;
    document.getElementById('prodPrice').value = p.price;
    document.getElementById('prodStock').value = p.stock;
    document.getElementById('prodCategory').value = p.category;
    document.getElementById('prodImage').value = p.image;
    showProductImagePreview(p.image);
  } else {
    document.getElementById('modalTitle').textContent = 'Add Product';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    showProductImagePreview('');
  }

  openModal(modal);
}

async function saveProduct() {
  const errorBox = document.getElementById('modalError');
  const id = document.getElementById('productId').value;

  const name = document.getElementById('prodName').value.trim();
  const description = document.getElementById('prodDescription').value.trim();
  const price = parseFloat(document.getElementById('prodPrice').value);
  const stock = parseInt(document.getElementById('prodStock').value, 10);
  const category = document.getElementById('prodCategory').value.trim();
  let image = document.getElementById('prodImage').value.trim();
  const imageFile = document.getElementById('prodImageFile').files[0];

  if (!name || !description || !category || (!image && !imageFile) || isNaN(price) || isNaN(stock)) {
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
    if (imageFile) {
      const dataUrl = await readFileAsDataUrl(imageFile);
      const uploadedImage = await ProductDB.uploadImage(dataUrl);
      payload.image = uploadedImage.image;
    }
    if (id) {
      await ProductDB.update(id, payload);
      showToast('Product updated successfully.');
    } else {
      await ProductDB.create(payload);
      showToast('Product added successfully.');
    }
    closeModal(document.getElementById('productModal'));
    await renderProductsTable();
    await renderStats();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add('show');
  }
}

function showProductImagePreview(src) {
  const preview = document.getElementById('prodImagePreview');
  if (pendingImagePreviewUrl) URL.revokeObjectURL(pendingImagePreviewUrl);
  pendingImagePreviewUrl = src.startsWith('blob:') ? src : null;
  preview.src = src;
  preview.hidden = !src;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(new Error('Could not read the selected image.')));
    reader.readAsDataURL(file);
  });
}

/* ---------- Delete Modal ---------- */
function setupDeleteModal() {
  const modal = document.getElementById('deleteModal');
  document.getElementById('cancelDeleteBtn').addEventListener('click', () => closeModal(modal));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });

  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    try {
      await ProductDB.delete(pendingDeleteId);
      showToast('Product deleted.');
      closeModal(modal);
      await renderProductsTable();
      await renderStats();
      pendingDeleteId = null;
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

async function openDeleteModal(productId) {
  const product = await ProductDB.getById(productId);
  if (!product) return;
  pendingDeleteId = productId;
  document.getElementById('deleteProductName').textContent = product.name;
  openModal(document.getElementById('deleteModal'));
}

/* ---------- Modal helpers ---------- */
function openModal(modal) { modal.classList.add('show'); }
function closeModal(modal) { modal.classList.remove('show'); }
