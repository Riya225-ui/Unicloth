const express = require('express');
const db = require('../database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
  const { customer_name, customer_email, customer_phone, delivery_address, district, payment_method, items } = req.body;

  if (!items || items.length === 0) return res.status(400).json({ error: 'No items in order.' });
  if (!customer_name || !customer_phone || !delivery_address || !district) {
    return res.status(400).json({ error: 'Complete shipping information is required.' });
  }

  let total = 0;
  const productData = [];

  try {
    for (const item of items) {
      const [products] = await db.query('SELECT name, image_url, price, stock FROM products WHERE id = ? AND is_active = 1', [item.product_id]);
      if (products.length === 0) return res.status(400).json({ error: `Product ${item.product_id} not found.` });
      const product = products[0];
      if (product.stock < item.quantity) return res.status(400).json({ error: `Insufficient stock for product ID: ${item.product_id}.` });
      
      total += product.price * item.quantity;
      productData.push({ ...item, name: product.name, image_url: product.image_url, price: product.price });
    }

    let delivery_charge = 0;
    if (total < 2000) {
      delivery_charge = (district.toLowerCase() === 'dhaka') ? 80 : 150;
    }

    const user_id = req.user.id;

    
    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
      const [orderResult] = await conn.query(`
        INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, total_amount, delivery_charge, payment_method, delivery_address, district)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        user_id || null, 
        customer_name || null, 
        customer_email || null, 
        customer_phone || null, 
        total || 0, 
        delivery_charge || 0, 
        payment_method || null, 
        delivery_address || null, 
        district || null
      ]);

      const orderId = orderResult.insertId;

      for (const item of productData) {
        await conn.query(`
          INSERT INTO order_items (order_id, product_id, product_name, product_image, quantity, unit_price, size)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [orderId, item.product_id, item.name, item.image_url, item.quantity, item.price, item.size || 'M']);
        
        await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
      }

      await conn.commit();
      conn.release();
      res.status(201).json({ orderId, total: total + delivery_charge });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error while placing order.' });
  }
});

router.get('/my-orders', authMiddleware, async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT o.*, GROUP_CONCAT(oi.product_name SEPARATOR ', ') as product_names
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [req.user.id]);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/admin/all', adminMiddleware, async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT o.*, GROUP_CONCAT(CONCAT(oi.product_name, ' (x', oi.quantity, ')') SEPARATOR ', ') as order_details
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/admin/:id/status', adminMiddleware, async (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  
  try {
    await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
