
import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// --- SQLite setup (optional persistence).
// If DB init fails, we will fall back to in-memory cart/products.
let db;
let useDb = true;
function openDb() {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(__dirname, 'vibe_cart.db');
    const dbConn = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
      resolve(dbConn);
    });
  });
}

async function initDb() {
  try {
    db = await openDb();
    await run(`PRAGMA foreign_keys = ON;`);
    await run(`CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      image TEXT
    );`);
    await run(`CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      productId TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      UNIQUE(userId, productId),
      FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
    );`);

    // Seed products if empty
    const count = await get(`SELECT COUNT(*) as c FROM products;`);
    if (count.c === 0) {
      const seed = [
        { id: 'p1', name: 'Bluetooth Headphones', price: 1999, image: '🎧' },
        { id: 'p2', name: 'Wireless Mouse', price: 699, image: '🖱️' },
        { id: 'p3', name: 'Mechanical Keyboard', price: 3499, image: '⌨️' },
        { id: 'p4', name: 'USB-C Cable', price: 299, image: '🔌' },
        { id: 'p5', name: 'Portable SSD 500GB', price: 4999, image: '💾' },
        { id: 'p6', name: 'Smartwatch', price: 5999, image: '⌚' },
        { id: 'p7', name: 'Phone Stand', price: 249, image: '📱' }
      ];
      await run('BEGIN TRANSACTION;');
      for (const p of seed) {
        await run(`INSERT INTO products (id, name, price, image) VALUES (?,?,?,?);`, [p.id, p.name, p.price, p.image]);
      }
      await run('COMMIT;');
    }

    console.log('SQLite ready ✅');
  } catch (e) {
    console.error('SQLite failed, switching to in-memory store ❗', e.message);
    useDb = false;
  }
}

// --- SQLite helpers
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function(err, row) {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function(err, rows) {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// --- In-memory fallback
const mem = {
  products: [
    { id: 'p1', name: 'Bluetooth Headphones', price: 1999, image: '🎧' },
    { id: 'p2', name: 'Wireless Mouse', price: 699, image: '🖱️' },
    { id: 'p3', name: 'Mechanical Keyboard', price: 3499, image: '⌨️' },
    { id: 'p4', name: 'USB-C Cable', price: 299, image: '🔌' },
    { id: 'p5', name: 'Portable SSD 500GB', price: 4999, image: '💾' },
    { id: 'p6', name: 'Smartwatch', price: 5999, image: '⌚' },
    { id: 'p7', name: 'Phone Stand', price: 249, image: '📱' }
  ],
  cart: [] // {userId, productId, qty}
};
const DEMO_USER = 'demo';

// --- API routes

// GET /api/products
app.get('/api/products', async (req, res) => {
  try {
    if (useDb) {
      const rows = await all(`SELECT id, name, price, image FROM products;`);
      return res.json(rows);
    } else {
      return res.json(mem.products);
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// POST /api/cart { productId, qty }
app.post('/api/cart', async (req, res) => {
  const { productId, qty } = req.body || {};
  if (!productId || typeof qty !== 'number' || qty <= 0) {
    return res.status(400).json({ error: 'productId and qty>0 required' });
  }
  try {
    if (useDb) {
      // ensure product exists
      const p = await get(`SELECT id FROM products WHERE id = ?;`, [productId]);
      if (!p) return res.status(404).json({ error: 'Product not found' });
      // upsert
      const existing = await get(`SELECT * FROM cart WHERE userId = ? AND productId = ?;`, [DEMO_USER, productId]);
      if (existing) {
        await run(`UPDATE cart SET qty = ? WHERE id = ?;`, [qty, existing.id]);
      } else {
        await run(`INSERT INTO cart (userId, productId, qty) VALUES (?,?,?);`, [DEMO_USER, productId, qty]);
      }
    } else {
      const idx = mem.cart.findIndex(c => c.userId === DEMO_USER && c.productId === productId);
      if (idx >= 0) mem.cart[idx].qty = qty;
      else mem.cart.push({ userId: DEMO_USER, productId, qty });
    }
    return getCart(req, res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// DELETE /api/cart/:id  (id is productId here for simplicity)
app.delete('/api/cart/:id', async (req, res) => {
  const productId = req.params.id;
  try {
    if (useDb) {
      await run(`DELETE FROM cart WHERE userId = ? AND productId = ?;`, [DEMO_USER, productId]);
    } else {
      const before = mem.cart.length;
      mem.cart = mem.cart.filter(c => !(c.userId === DEMO_USER && c.productId === productId));
    }
    return getCart(req, res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// GET /api/cart
app.get('/api/cart', async (req, res) => {
  return getCart(req, res);
});

async function getCart(req, res) {
  try {
    let items = [];
    if (useDb) {
      const rows = await all(`
        SELECT c.productId as id, p.name, p.price, p.image, c.qty
        FROM cart c
        JOIN products p ON p.id = c.productId
        WHERE c.userId = ?;`, [DEMO_USER]);
      items = rows.map(r => ({ id: r.id, name: r.name, price: r.price, image: r.image, qty: r.qty }));
    } else {
      const map = new Map(mem.products.map(p => [p.id, p]));
      items = mem.cart
        .filter(c => c.userId === DEMO_USER)
        .map(c => ({ ...map.get(c.productId), qty: c.qty }));
    }
    const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);
    res.json({ items, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get cart' });
  }
}

// POST /api/checkout { cartItems }
app.post('/api/checkout', async (req, res) => {
  try {
    // In real apps, validate stock, process payments, etc.
    const cart = await new Promise((resolve) => {
      // reuse getCart logic without response
      (async () => {
        let items = [];
        if (useDb) {
          const rows = await all(`
            SELECT c.productId as id, p.name, p.price, p.image, c.qty
            FROM cart c
            JOIN products p ON p.id = c.productId
            WHERE c.userId = ?;`, [DEMO_USER]);
          items = rows.map(r => ({ id: r.id, name: r.name, price: r.price, image: r.image, qty: r.qty }));
        } else {
          const map = new Map(mem.products.map(p => [p.id, p]));
          items = mem.cart
            .filter(c => c.userId === DEMO_USER)
            .map(c => ({ ...map.get(c.productId), qty: c.qty }));
        }
        const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);
        resolve({ items, total });
      })();
    });

    const timestamp = new Date().toISOString();
    const receipt = {
      id: 'rcpt_' + Math.random().toString(36).slice(2, 8),
      total: cart.total,
      items: cart.items,
      timestamp
    };

    // Clear cart after mock checkout
    if (useDb) {
      await run(`DELETE FROM cart WHERE userId = ?;`, [DEMO_USER]);
    } else {
      mem.cart = mem.cart.filter(c => c.userId !== DEMO_USER);
    }

    res.json(receipt);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

initDb().finally(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
