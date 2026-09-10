const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'unicloth_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const dbName = process.env.DB_NAME || 'unicloth_db';

async function initDB() {
  try {
    // Try to create database if it doesn't exist (mostly for local development)
    try {
      const tempConn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: process.env.DB_PORT || 3306
      });
      await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      await tempConn.end();
    } catch (createErr) {
      console.log("Skipping database creation (usually normal for cloud databases).");
    }

    const conn = await pool.getConnection();

    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        address TEXT,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(100),
        image_url TEXT,
        stock INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255),
        customer_phone VARCHAR(50) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        delivery_charge DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        payment_method VARCHAR(50),
        payment_status VARCHAR(50) DEFAULT 'unpaid',
        transaction_id VARCHAR(100),
        delivery_address TEXT,
        district VARCHAR(100),
        delivery_type VARCHAR(50) DEFAULT 'home',
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        product_name VARCHAR(255),
        product_image TEXT,
        quantity INT NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        size VARCHAR(20),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    const [users] = await conn.query('SELECT COUNT(*) as c FROM users');
    if (users[0].c === 0) {
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync('admin123', 10);
      await conn.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        ['Admin', 'admin@unicloth.com', hash, 'admin']
      );
    }

    const [products] = await conn.query('SELECT COUNT(*) as c FROM products');
    if (products[0].c === 0) {
      const productsData = [
        ['Mens Premium Formal Shirt', 'High quality cotton formal shirt', 1200, 'men', 'https://images.unsplash.com/photo-1596755094514-f87e32f85e2c?auto=format&fit=crop&w=600&q=80', 50],
        ['Traditional Jamdani Saree', 'Authentic handloom jamdani saree', 4500, 'women', 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80', 20],
        ['Mens Urban Casual T-Shirt', 'Comfortable everyday wear', 450, 'men', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80', 100],
        ['Designer Cotton Kurti', 'Elegant design for any occasion', 1500, 'women', 'https://images.unsplash.com/photo-1583391733958-d25e07fac04f?auto=format&fit=crop&w=600&q=80', 30],
        ['Classic Slim Fit Denim', 'Premium stretchable denim jeans', 1800, 'men', 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80', 40],
        ['Flowy Palazzo Pants', 'Breathable summer wear', 850, 'women', 'https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?auto=format&fit=crop&w=600&q=80', 60],
        ['Festive Silk Panjabi', 'Exclusive Eid collection', 2200, 'men', 'https://images.unsplash.com/photo-1592878904946-b3ce8ae24ea5?auto=format&fit=crop&w=600&q=80', 25],
        ['Evening Glamour Dress', 'Stunning party wear', 3500, 'women', 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=600&q=80', 15]
      ];
      for (const p of productsData) {
        await conn.query(
          'INSERT INTO products (name, description, price, category, image_url, stock) VALUES (?, ?, ?, ?, ?, ?)',
          p
        );
      }
    }

    conn.release();
    console.log("MySQL Database Connected and Synced.");
  } catch (err) {
    console.error("MySQL Init Error:", err);
  }
}

initDB();

module.exports = pool;
