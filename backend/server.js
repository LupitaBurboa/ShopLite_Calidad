const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const app = express();
const port = Number(process.env.PORT) || 3000;
const rootDirectory = path.resolve(__dirname, '..');
const dataDirectory = path.join(rootDirectory, 'data');
const frontendDirectory = path.join(rootDirectory, 'frontend');
const imagesDirectory = path.join(rootDirectory, 'images');
fs.mkdirSync(dataDirectory, { recursive: true });
fs.mkdirSync(imagesDirectory, { recursive: true });

const db = new Database(path.join(dataDirectory, 'shoplite.sqlite'));
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL CHECK (stock >= 0),
    category TEXT NOT NULL,
    image TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL CHECK (qty > 0),
    PRIMARY KEY (user_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    subtotal REAL NOT NULL,
    tax REAL NOT NULL,
    shipping REAL NOT NULL,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'paid',
    shipping_full_name TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    shipping_city TEXT NOT NULL,
    shipping_zip TEXT NOT NULL,
    shipping_country TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    qty INTEGER NOT NULL CHECK (qty > 0)
  );
`);

const productCount = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
if (productCount === 0) {
  const addProduct = db.prepare(`
    INSERT INTO products (name, description, price, stock, category, image)
    VALUES (@name, @description, @price, @stock, @category, @image)
  `);
  const seedProducts = [
    ['Wireless Headphones', 'Over-ear wireless headphones with noise cancellation and 30-hour battery life.', 79.99, 25, 'Electronics', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'],
    ['Smart Watch', 'Fitness tracking smart watch with heart-rate monitor and GPS.', 129.99, 15, 'Electronics', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'],
    ['Running Shoes', 'Lightweight breathable running shoes, great for daily training.', 59.99, 40, 'Footwear', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'],
    ['Backpack', 'Durable water-resistant backpack with laptop compartment.', 45, 30, 'Accessories', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500'],
    ['Coffee Maker', 'Programmable drip coffee maker, makes up to 12 cups.', 39.5, 20, 'Home', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500'],
    ['Desk Lamp', 'LED desk lamp with adjustable brightness and USB charging port.', 24.99, 35, 'Home', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500']
  ];
  const seed = db.transaction(() => seedProducts.forEach(([name, description, price, stock, category, image]) => {
    addProduct.run({ name, description, price, stock, category, image });
  }));
  seed();
}

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password_hash, role)
  VALUES (?, ?, ?, ?)
`);
insertUser.run('Admin', 'admin@shop.com', bcrypt.hashSync('admin123', 10), 'admin');
insertUser.run('Demo User', 'user@shop.com', bcrypt.hashSync('user123', 10), 'user');

app.use(express.json({ limit: '7mb' }));
app.use(session({
  name: 'shoplite.sid',
  secret: process.env.SESSION_SECRET || 'development-only-change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(['/data', '/.git', '/server.js'], (req, res) => res.sendStatus(404));
app.use('/images', express.static(imagesDirectory));
app.use(express.static(frontendDirectory));

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.created_at };
}

function requireUser(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Please log in.' });
  next();
}

function requireAdmin(req, res, next) {
  const user = req.session.userId && db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  next();
}

function getCart(userId) {
  return db.prepare(`
    SELECT ci.product_id AS productId, ci.qty, p.name, p.description, p.price, p.stock,
           p.category, p.image, p.created_at AS createdAt
    FROM cart_items ci JOIN products p ON p.id = ci.product_id
    WHERE ci.user_id = ? ORDER BY p.id
  `).all(userId);
}

app.get('/api/session', (req, res) => {
  const user = req.session.userId && db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  res.json({ user: user ? publicUser(user) : null });
});

app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim() || !email?.trim() || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Enter a name, valid email, and password of at least 6 characters.' });
  }
  try {
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'user')
    `).run(name.trim(), email.trim(), bcrypt.hashSync(password, 10));
    req.session.userId = result.lastInsertRowid;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'An account with this email already exists.' });
    throw error;
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim());
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('shoplite.sid');
    res.status(204).end();
  });
});

app.get('/api/products', (req, res) => {
  res.json(db.prepare('SELECT *, created_at AS createdAt FROM products ORDER BY id').all());
});

app.get('/api/products/:id', (req, res) => {
  const product = db.prepare('SELECT *, created_at AS createdAt FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json(product);
});

app.post('/api/uploads/products', requireAdmin, (req, res) => {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(req.body?.dataUrl || '');
  if (!match) return res.status(400).json({ error: 'Choose a JPG, PNG, WEBP, or GIF image.' });

  const imageBuffer = Buffer.from(match[2], 'base64');
  if (imageBuffer.length === 0 || imageBuffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image must be smaller than 5 MB.' });
  }

  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[match[1]];
  const filename = `${crypto.randomUUID()}.${extension}`;
  fs.writeFileSync(path.join(imagesDirectory, filename), imageBuffer, { flag: 'wx' });
  res.status(201).json({ image: `/images/${filename}` });
});

app.post('/api/products', requireAdmin, (req, res) => {
  const { name, description, price, stock, category, image } = req.body || {};
  if (!name || !description || !category || !image || !Number.isFinite(Number(price)) || !Number.isInteger(Number(stock)) || Number(price) < 0 || Number(stock) < 0) {
    return res.status(400).json({ error: 'Product details are invalid.' });
  }
  const result = db.prepare(`
    INSERT INTO products (name, description, price, stock, category, image) VALUES (?, ?, ?, ?, ?, ?)
  `).run(name.trim(), description.trim(), Number(price), Number(stock), category.trim(), image.trim());
  res.status(201).json(db.prepare('SELECT *, created_at AS createdAt FROM products WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/products/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  const product = { ...existing, ...req.body };
  if (!product.name || !product.description || !product.category || !product.image || !Number.isFinite(Number(product.price)) || !Number.isInteger(Number(product.stock)) || Number(product.price) < 0 || Number(product.stock) < 0) {
    return res.status(400).json({ error: 'Product details are invalid.' });
  }
  db.prepare(`
    UPDATE products SET name = ?, description = ?, price = ?, stock = ?, category = ?, image = ? WHERE id = ?
  `).run(product.name.trim(), product.description.trim(), Number(product.price), Number(product.stock), product.category.trim(), product.image.trim(), req.params.id);
  res.json(db.prepare('SELECT *, created_at AS createdAt FROM products WHERE id = ?').get(req.params.id));
});

app.delete('/api/products/:id', requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Product not found.' });
  res.status(204).end();
});

app.get('/api/cart', requireUser, (req, res) => res.json(getCart(req.session.userId)));

app.delete('/api/cart', requireUser, (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.session.userId);
  res.status(204).end();
});

app.post('/api/cart', requireUser, (req, res) => {
  const productId = Number(req.body?.productId);
  const qty = Number(req.body?.qty ?? 1);
  const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const existing = db.prepare('SELECT qty FROM cart_items WHERE user_id = ? AND product_id = ?').get(req.session.userId, productId);
  const nextQty = (existing?.qty || 0) + qty;
  if (!Number.isInteger(qty) || qty < 1 || nextQty > product.stock) return res.status(400).json({ error: 'Requested quantity exceeds available stock.' });
  db.prepare(`
    INSERT INTO cart_items (user_id, product_id, qty) VALUES (?, ?, ?)
    ON CONFLICT(user_id, product_id) DO UPDATE SET qty = excluded.qty
  `).run(req.session.userId, productId, nextQty);
  res.json(getCart(req.session.userId));
});

app.patch('/api/cart/:productId', requireUser, (req, res) => {
  const productId = Number(req.params.productId);
  const qty = Number(req.body?.qty);
  if (!Number.isInteger(qty)) return res.status(400).json({ error: 'Quantity must be an integer.' });
  if (qty <= 0) {
    db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.session.userId, productId);
  } else {
    const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    if (qty > product.stock) return res.status(400).json({ error: `Only ${product.stock} in stock.` });
    db.prepare('UPDATE cart_items SET qty = ? WHERE user_id = ? AND product_id = ?').run(qty, req.session.userId, productId);
  }
  res.json(getCart(req.session.userId));
});

app.delete('/api/cart/:productId', requireUser, (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.session.userId, req.params.productId);
  res.json(getCart(req.session.userId));
});

app.get('/api/orders', requireUser, (req, res) => {
  const isAdmin = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId).role === 'admin';
  const orders = isAdmin
    ? db.prepare(`SELECT o.*, u.name AS userName FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC`).all()
    : db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.session.userId);
  const itemsQuery = db.prepare(`SELECT product_id AS productId, name, price, qty FROM order_items WHERE order_id = ?`);
  res.json(orders.map(order => ({
    id: order.id,
    userId: order.user_id,
    userName: order.userName,
    subtotal: order.subtotal,
    tax: order.tax,
    shipping: order.shipping,
    total: order.total,
    status: order.status,
    createdAt: order.created_at,
    shippingInfo: {
      fullName: order.shipping_full_name,
      address: order.shipping_address,
      city: order.shipping_city,
      zip: order.shipping_zip,
      country: order.shipping_country
    },
    items: itemsQuery.all(order.id)
  })));
});

app.get('/api/orders/:id', requireUser, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const currentUser = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
  if (order.user_id !== req.session.userId && currentUser.role !== 'admin') return res.status(403).json({ error: 'Access denied.' });
  res.json({
    id: order.id,
    userId: order.user_id,
    subtotal: order.subtotal,
    tax: order.tax,
    shipping: order.shipping,
    total: order.total,
    status: order.status,
    createdAt: order.created_at,
    items: db.prepare('SELECT product_id AS productId, name, price, qty FROM order_items WHERE order_id = ?').all(order.id)
  });
});

app.post('/api/orders', requireUser, (req, res) => {
  const shippingInfo = req.body?.shippingInfo || {};
  const requiredFields = ['fullName', 'address', 'city', 'zip', 'country'];
  if (requiredFields.some(field => !String(shippingInfo[field] || '').trim())) {
    return res.status(400).json({ error: 'Complete all shipping details.' });
  }
  const userId = req.session.userId;
  const createOrder = db.transaction(() => {
    const items = getCart(userId);
    if (!items.length) throw new Error('Your cart is empty.');
    for (const item of items) {
      const stock = db.prepare('SELECT stock FROM products WHERE id = ?').get(item.productId)?.stock;
      if (stock === undefined || stock < item.qty) throw new Error(`Not enough stock for ${item.name}.`);
    }
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const tax = subtotal * 0.08;
    const shipping = subtotal >= 75 ? 0 : 5;
    const total = subtotal + tax + shipping;
    const orderResult = db.prepare(`
      INSERT INTO orders (user_id, subtotal, tax, shipping, total, shipping_full_name, shipping_address, shipping_city, shipping_zip, shipping_country)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, subtotal, tax, shipping, total,
      shippingInfo.fullName.trim(), shippingInfo.address.trim(), shippingInfo.city.trim(), shippingInfo.zip.trim(), shippingInfo.country.trim());
    const addItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES (?, ?, ?, ?, ?)');
    const decrementStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    for (const item of items) {
      addItem.run(orderResult.lastInsertRowid, item.productId, item.name, item.price, item.qty);
      decrementStock.run(item.qty, item.productId);
    }
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
    return {
      id: orderResult.lastInsertRowid,
      userId,
      subtotal,
      tax,
      shipping,
      total,
      status: 'paid',
      createdAt: new Date().toISOString(),
      items: items.map(({ productId, name, price, qty }) => ({ productId, name, price, qty }))
    };
  });
  try {
    res.status(201).json(createOrder());
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT id, name, email, role, created_at AS createdAt FROM users ORDER BY id').all());
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

app.listen(port, () => {
  console.log(`ShopLite is running at http://localhost:${port}`);
});