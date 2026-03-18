require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ========== DATABASE CONNECTION ==========
let pool;
try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  console.log('✅ Database pool created');
} catch (error) {
  console.error('❌ Database pool error:', error.message);
}

// ========== TEST ROUTE ==========
app.get('/', (req, res) => {
  res.send('EarnTesters API is running!');
});

app.get('/health', async (req, res) => {
  try {
    if (pool) {
      const result = await pool.query('SELECT NOW()');
      res.json({
        status: 'healthy',
        database: 'connected',
        time: result.rows[0].now
      });
    } else {
      res.json({
        status: 'degraded',
        database: 'disconnected'
      });
    }
  } catch (error) {
    res.json({
      status: 'error',
      database: 'error',
      error: error.message
    });
  }
});

// ========== SIGNUP ENDPOINT ==========
app.post('/new', async (req, res) => {
  try {
    const { full_name, email, type, devices, interests, source } = req.body;
    
    if (!full_name || !email || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Insert new user
    const result = await pool.query(
      `INSERT INTO users (full_name, email, type, devices, interests, source)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, full_name, email, type`,
      [full_name, email, type, devices || [], interests || [], source || '']
    );
    
    res.status(201).json({
      success: true,
      user: result.rows[0],
      redirect: type === 'Tester' ? 'tester-dash.html' : 'developer-dash.html'
    });
    
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== GET ALL APPS ==========
app.get('/test', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM apps ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== START SERVER ==========
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🌍 Health check: /health`);
});