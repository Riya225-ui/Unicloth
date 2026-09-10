const express = require('express');
const SSLCommerzPayment = require('sslcommerz-lts');
const db = require('../database');

const router = express.Router();

const store_id = process.env.SSLCOMMERZ_STORE_ID;
const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD;
const is_live = process.env.SSLCOMMERZ_IS_LIVE === 'true';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

router.post('/initiate', async (req, res) => {
  const { orderId } = req.body;
  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found.' });
    const order = orders[0];

    const tran_id = `UC${orderId}_${Date.now()}`;
    await db.query('UPDATE orders SET transaction_id = ? WHERE id = ?', [tran_id, orderId]);

    const total = parseFloat(order.total_amount) + parseFloat(order.delivery_charge);

    const data = {
      total_amount: total,
      currency: 'BDT',
      tran_id,
      success_url: `${BASE_URL}/api/payment/success`,
      fail_url: `${BASE_URL}/api/payment/fail`,
      cancel_url: `${BASE_URL}/api/payment/cancel`,
      ipn_url: `${BASE_URL}/api/payment/ipn`,
      shipping_method: 'Courier',
      product_name: 'UniCloth Order',
      product_category: 'Clothing',
      product_profile: 'general',
      cus_name: order.customer_name,
      cus_email: order.customer_email || 'customer@unicloth.com',
      cus_add1: order.delivery_address || 'Dhaka',
      cus_city: order.district || 'Dhaka',
      cus_postcode: '1000',
      cus_country: 'Bangladesh',
      cus_phone: order.customer_phone,
      ship_name: order.customer_name,
      ship_add1: order.delivery_address || 'Dhaka',
      ship_city: order.district || 'Dhaka',
      ship_postcode: '1000',
      ship_country: 'Bangladesh',
    };

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const apiResponse = await sslcz.init(data);
    if (apiResponse?.GatewayPageURL) {
      res.json({ url: apiResponse.GatewayPageURL });
    } else {
      res.status(500).json({ error: 'Failed to initiate payment.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Payment gateway error.' });
  }
});

router.post('/success', express.urlencoded({ extended: true }), async (req, res) => {
  const { tran_id, val_id, status } = req.body;
  if (status !== 'VALID') return res.redirect(`${BASE_URL}/public_v2/order-failed.html`);

  try {
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const validation = await sslcz.validate({ val_id });
    if (validation?.status === 'VALID') {
      await db.query("UPDATE orders SET payment_status = 'paid', status = 'confirmed' WHERE transaction_id = ?", [tran_id]);
      const [orders] = await db.query('SELECT id FROM orders WHERE transaction_id = ?', [tran_id]);
      return res.redirect(`${BASE_URL}/public_v2/order-success.html?orderId=${orders[0]?.id}&paid=true`);
    }
  } catch (e) {
    console.error(e);
  }
  res.redirect(`${BASE_URL}/public_v2/order-failed.html`);
});

router.post('/fail', express.urlencoded({ extended: true }), async (req, res) => {
  const { tran_id } = req.body;
  if (tran_id) {
    await db.query("UPDATE orders SET payment_status = 'failed' WHERE transaction_id = ?", [tran_id]);
  }
  res.redirect(`${BASE_URL}/public_v2/checkout.html?paymentFailed=true`);
});

router.post('/cancel', express.urlencoded({ extended: true }), async (req, res) => {
  res.redirect(`${BASE_URL}/public_v2/checkout.html?paymentCancelled=true`);
});

router.post('/ipn', express.urlencoded({ extended: true }), (req, res) => {
  res.status(200).send('OK');
});

module.exports = router;
