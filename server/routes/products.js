const express = require('express');
const db = require('../database');
const { adminMiddleware } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, sort } = req.query;
    let query = 'SELECT * FROM products WHERE is_active = 1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      query += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }
    if (minPrice) {
      query += ' AND price >= ?';
      params.push(parseFloat(minPrice));
    }
    if (maxPrice) {
      query += ' AND price <= ?';
      params.push(parseFloat(maxPrice));
    }

    if (sort === 'price-asc') {
      query += ' ORDER BY price ASC';
    } else if (sort === 'price-desc') {
      query += ' ORDER BY price DESC';
    } else if (sort === 'name') {
      query += ' ORDER BY name ASC';
    } else {
      query += ' ORDER BY id DESC'; 
    }

    const { limit } = req.query;
    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit, 10));
    }

    const [products] = await db.query(query, params);
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [products] = await db.query('SELECT * FROM products WHERE id = ? AND is_active = 1', [req.params.id]);
    if (products.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(products[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});


router.post('/', adminMiddleware, async (req, res) => {
  const { name, description, price, category, image_url, stock } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Name, price, and category are required.' });
  }
  try {
    const [result] = await db.query(
      'INSERT INTO products (name, description, price, category, image_url, stock) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || '', price, category, image_url || '', stock || 0]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error while adding product.' });
  }
});


router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    await db.query('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Product removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error while removing product.' });
  }
});

module.exports = router;
