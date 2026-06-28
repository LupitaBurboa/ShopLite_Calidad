/* =========================================================
   db.js — Local "database" layer using localStorage
   Acts as a stand-in for a real backend/database.
   ========================================================= */

const DB_KEYS = {
  USERS: 'ecom_users',
  PRODUCTS: 'ecom_products',
  CART: 'ecom_cart',          // cart is per logged-in user, keyed inside object
  ORDERS: 'ecom_orders',
  SESSION: 'ecom_session',
  INIT_FLAG: 'ecom_initialized'
};

/* ---------- generic helpers ---------- */
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('Failed to parse', key, e);
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function genId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

/* simple hash so passwords aren't sitting in plain text in localStorage.
   NOTE: this is NOT secure crypto — fine for a demo/local project only. */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return 'h' + Math.abs(hash).toString(36) + str.length;
}

/* ---------- seed data (runs once) ---------- */
function seedDatabase() {
  if (localStorage.getItem(DB_KEYS.INIT_FLAG)) return;

  const defaultUsers = [
    {
      id: genId('user'),
      name: 'Admin',
      email: 'admin@shop.com',
      password: simpleHash('admin123'),
      role: 'admin',
      createdAt: new Date().toISOString()
    },
    {
      id: genId('user'),
      name: 'Demo User',
      email: 'user@shop.com',
      password: simpleHash('user123'),
      role: 'user',
      createdAt: new Date().toISOString()
    }
  ];

  const defaultProducts = [
    {
      id: genId('prod'),
      name: 'Wireless Headphones',
      description: 'Over-ear wireless headphones with noise cancellation and 30-hour battery life.',
      price: 79.99,
      stock: 25,
      category: 'Electronics',
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
      createdAt: new Date().toISOString()
    },
    {
      id: genId('prod'),
      name: 'Smart Watch',
      description: 'Fitness tracking smart watch with heart-rate monitor and GPS.',
      price: 129.99,
      stock: 15,
      category: 'Electronics',
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
      createdAt: new Date().toISOString()
    },
    {
      id: genId('prod'),
      name: 'Running Shoes',
      description: 'Lightweight breathable running shoes, great for daily training.',
      price: 59.99,
      stock: 40,
      category: 'Footwear',
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
      createdAt: new Date().toISOString()
    },
    {
      id: genId('prod'),
      name: 'Backpack',
      description: 'Durable water-resistant backpack with laptop compartment.',
      price: 45.00,
      stock: 30,
      category: 'Accessories',
      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500',
      createdAt: new Date().toISOString()
    },
    {
      id: genId('prod'),
      name: 'Coffee Maker',
      description: 'Programmable drip coffee maker, makes up to 12 cups.',
      price: 39.50,
      stock: 20,
      category: 'Home',
      image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500',
      createdAt: new Date().toISOString()
    },
    {
      id: genId('prod'),
      name: 'Desk Lamp',
      description: 'LED desk lamp with adjustable brightness and USB charging port.',
      price: 24.99,
      stock: 35,
      category: 'Home',
      image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500',
      createdAt: new Date().toISOString()
    }
  ];

  writeJSON(DB_KEYS.USERS, defaultUsers);
  writeJSON(DB_KEYS.PRODUCTS, defaultProducts);
  writeJSON(DB_KEYS.ORDERS, []);
  writeJSON(DB_KEYS.CART, {});
  localStorage.setItem(DB_KEYS.INIT_FLAG, 'true');
}

seedDatabase();

/* ---------- Users ---------- */
const UserDB = {
  getAll() {
    return readJSON(DB_KEYS.USERS, []);
  },
  findByEmail(email) {
    return this.getAll().find(u => u.email.toLowerCase() === email.toLowerCase());
  },
  create({ name, email, password, role = 'user' }) {
    const users = this.getAll();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('An account with this email already exists.');
    }
    const newUser = {
      id: genId('user'),
      name,
      email,
      password: simpleHash(password),
      role,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    writeJSON(DB_KEYS.USERS, users);
    return newUser;
  },
  verifyCredentials(email, password) {
    const user = this.findByEmail(email);
    if (!user) return null;
    if (user.password !== simpleHash(password)) return null;
    return user;
  }
};

/* ---------- Products ---------- */
const ProductDB = {
  getAll() {
    return readJSON(DB_KEYS.PRODUCTS, []);
  },
  getById(id) {
    return this.getAll().find(p => p.id === id);
  },
  create(product) {
    const products = this.getAll();
    const newProduct = {
      id: genId('prod'),
      createdAt: new Date().toISOString(),
      ...product
    };
    products.push(newProduct);
    writeJSON(DB_KEYS.PRODUCTS, products);
    return newProduct;
  },
  update(id, updates) {
    const products = this.getAll();
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Product not found.');
    products[idx] = { ...products[idx], ...updates };
    writeJSON(DB_KEYS.PRODUCTS, products);
    return products[idx];
  },
  delete(id) {
    const products = this.getAll().filter(p => p.id !== id);
    writeJSON(DB_KEYS.PRODUCTS, products);
  },
  decrementStock(id, qty) {
    const product = this.getById(id);
    if (!product) return;
    const newStock = Math.max(0, product.stock - qty);
    this.update(id, { stock: newStock });
  }
};

/* ---------- Cart (per user) ---------- */
const CartDB = {
  _all() {
    return readJSON(DB_KEYS.CART, {});
  },
  _saveAll(all) {
    writeJSON(DB_KEYS.CART, all);
  },
  getCart(userId) {
    const all = this._all();
    return all[userId] || [];
  },
  saveCart(userId, items) {
    const all = this._all();
    all[userId] = items;
    this._saveAll(all);
  },
  addItem(userId, productId, qty = 1) {
    const items = this.getCart(userId);
    const existing = items.find(i => i.productId === productId);
    if (existing) {
      existing.qty += qty;
    } else {
      items.push({ productId, qty });
    }
    this.saveCart(userId, items);
    return items;
  },
  updateQty(userId, productId, qty) {
    let items = this.getCart(userId);
    if (qty <= 0) {
      items = items.filter(i => i.productId !== productId);
    } else {
      const existing = items.find(i => i.productId === productId);
      if (existing) existing.qty = qty;
    }
    this.saveCart(userId, items);
    return items;
  },
  removeItem(userId, productId) {
    const items = this.getCart(userId).filter(i => i.productId !== productId);
    this.saveCart(userId, items);
    return items;
  },
  clearCart(userId) {
    this.saveCart(userId, []);
  }
};

/* ---------- Orders ---------- */
const OrderDB = {
  getAll() {
    return readJSON(DB_KEYS.ORDERS, []);
  },
  getByUser(userId) {
    return this.getAll().filter(o => o.userId === userId);
  },
  create(order) {
    const orders = this.getAll();
    const newOrder = {
      id: genId('order'),
      createdAt: new Date().toISOString(),
      status: 'paid',
      ...order
    };
    orders.push(newOrder);
    writeJSON(DB_KEYS.ORDERS, orders);
    return newOrder;
  }
};

/* ---------- Session ---------- */
const SessionDB = {
  getCurrentUser() {
    const session = readJSON(DB_KEYS.SESSION, null);
    if (!session) return null;
    const user = UserDB.getAll().find(u => u.id === session.userId);
    return user || null;
  },
  login(user) {
    writeJSON(DB_KEYS.SESSION, { userId: user.id });
  },
  logout() {
    localStorage.removeItem(DB_KEYS.SESSION);
  }
};
