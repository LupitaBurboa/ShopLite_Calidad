/* =========================================================
   db.js — Browser client for the Express/SQLite data API
   ========================================================= */

/* ---------- Users ---------- */
const UserDB = {
  async getAll() {
    return apiRequest('/admin/users');
  },
  async create(user) {
    const result = await apiRequest('/register', { method: 'POST', body: JSON.stringify(user) });
    return result.user;
  }
};

/* ---------- Products ---------- */
const ProductDB = {
  async getAll() {
    return (await apiRequest('/products')).map(normalizeProduct);
  },
  async getById(id) {
    try {
      return normalizeProduct(await apiRequest(`/products/${encodeURIComponent(id)}`));
    } catch (error) {
      if (error.message === 'Product not found.') return null;
      throw error;
    }
  },
  async create(product) {
    return normalizeProduct(await apiRequest('/products', { method: 'POST', body: JSON.stringify(product) }));
  },
  async uploadImage(dataUrl) {
    return apiRequest('/uploads/products', { method: 'POST', body: JSON.stringify({ dataUrl }) });
  },
  async update(id, updates) {
    return normalizeProduct(await apiRequest(`/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }));
  },
  async delete(id) {
    return apiRequest(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
};

/* ---------- Cart (per user) ---------- */
const CartDB = {
  async getCart() {
    const items = await apiRequest('/cart');
    return items.map(item => ({ productId: String(item.productId), qty: item.qty }));
  },
  async addItem(userId, productId, qty = 1) {
    const items = await apiRequest('/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, qty })
    });
    return items.map(item => ({ productId: String(item.productId), qty: item.qty }));
  },
  async updateQty(userId, productId, qty) {
    const items = await apiRequest(`/cart/${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ qty })
    });
    return items.map(item => ({ productId: String(item.productId), qty: item.qty }));
  },
  async removeItem(userId, productId) {
    const items = await apiRequest(`/cart/${encodeURIComponent(productId)}`, { method: 'DELETE' });
    return items.map(item => ({ productId: String(item.productId), qty: item.qty }));
  },
  async clearCart() {
    return apiRequest('/cart', { method: 'DELETE' });
  }
};

/* ---------- Orders ---------- */
const OrderDB = {
  getAll() {
    return apiRequest('/orders');
  },
  getById(id) {
    return apiRequest(`/orders/${encodeURIComponent(id)}`);
  },
  create(order) {
    return apiRequest('/orders', { method: 'POST', body: JSON.stringify(order) });
  }
};

/* ---------- Session ---------- */
const SessionDB = {
  async getCurrentUser() {
    return (await apiRequest('/session')).user;
  },
  async login(email, password) {
    return (await apiRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })).user;
  },
  async logout() {
    return apiRequest('/logout', { method: 'POST' });
  }
};

async function apiRequest(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function normalizeProduct(product) {
  return { ...product, id: String(product.id) };
}
