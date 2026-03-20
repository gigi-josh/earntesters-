require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(__dirname));

// Initialize database
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL,
        devices TEXT[] DEFAULT '{}',
        interests TEXT[] DEFAULT '{}',
        source VARCHAR(255),
        earnings DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS apps (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(50) DEFAULT '📱',
        category VARCHAR(100) NOT NULL,
        pay VARCHAR(100) NOT NULL,
        type VARCHAR(100) DEFAULT 'Mobile App',
        platform VARCHAR(100) DEFAULT 'Android & iOS',
        test_focus TEXT[] DEFAULT '{}',
        screenshot TEXT,
        developer VARCHAR(255) DEFAULT 'Unknown',
        url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS bugs (
        id SERIAL PRIMARY KEY,
        app_id INTEGER REFERENCES apps(id) ON DELETE CASCADE,
        app_name VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        severity VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        steps TEXT,
        device VARCHAR(255),
        screenshot TEXT,
        tester VARCHAR(255) DEFAULT 'Anonymous',
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_bugs_app_id ON bugs(app_id);
    `);
    console.log('✅ Database ready');
  } catch (err) {
    console.error('DB init error:', err);
  } finally {
    client.release();
  }
}

pool.connect(async (err) => {
  if (err) return console.error('❌ DB connection failed:', err.message);
  console.log('✅ Connected to PostgreSQL');
  await initDB();
});

// ========== USER ROUTES ==========
app.get('/api/me', async (req, res) => {
  const userId = req.cookies.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  
  const result = await pool.query('SELECT id, full_name, email, type, earnings FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json(result.rows[0]);
});

app.get('/api/earnings/:userId', async (req, res) => {
  const result = await pool.query('SELECT earnings FROM users WHERE id = $1', [req.params.userId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ earnings: result.rows[0].earnings || 0 });
});

app.post('/api/earnings/add', async (req, res) => {
  const { userId, amount } = req.body;
  await pool.query('BEGIN');
  await pool.query('UPDATE users SET earnings = earnings + $1 WHERE id = $2', [amount, userId]);
  const result = await pool.query('SELECT earnings FROM users WHERE id = $1', [userId]);
  await pool.query('COMMIT');
  res.json({ success: true, earnings: result.rows[0].earnings });
});

app.post('/new', async (req, res) => {
  const { full_name, email, type, devices, interests, source } = req.body;
  
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already exists' });
  
  const result = await pool.query(
    `INSERT INTO users (full_name, email, type, devices, interests, source, earnings)
     VALUES ($1, $2, $3, $4, $5, $6, 0) RETURNING id, full_name, email, type, earnings`,
    [full_name, email, type, devices || [], interests || [], source || '']
  );
  
  res.cookie('userId', result.rows[0].id, { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'strict' });
  res.status(201).json({ success: true, user: result.rows[0], redirect: type === 'Tester' ? 'tester-dash.html' : 'developer-dash.html' });
});

app.post('/login', async (req, res) => {
  const { identifier, password } = req.body;
  const result = await pool.query('SELECT id, full_name, email, type, earnings FROM users WHERE email = $1', [identifier]);
  if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
  
  res.cookie('userId', result.rows[0].id, { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'strict' });
  res.json({ success: true, user: result.rows[0], redirect: result.rows[0].type === 'Tester' ? 'tester-dash.html' : 'developer-dash.html' });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('userId');
  res.json({ success: true });
});

// ========== APP ROUTES ==========
app.post('/get-from', async (req, res) => {
  const { id } = req.body;
  const result = await pool.query('SELECT * FROM apps WHERE id = $1', [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'App not found' });
  res.json(result.rows[0]);
});

app.get('/test', async (req, res) => {
  const result = await pool.query('SELECT * FROM apps ORDER BY created_at DESC');
  res.json(result.rows);
});

app.post('/api/test', async (req, res) => {
  const { name, icon, category, pay, type, platform, url, developer } = req.body;
  const result = await pool.query(
    `INSERT INTO apps (name, icon, category, pay, type, platform, url, developer)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [name, icon || '📱', category, pay, type || 'Mobile App', platform || 'Android & iOS', url || null, developer || 'Unknown']
  );
  res.status(201).json(result.rows[0]);
});

// ========== BUG ROUTES ==========
app.post('/api/bugs', async (req, res) => {
  const { appId, appName, title, severity, description, steps, device, tester } = req.body;
  const result = await pool.query(
    `INSERT INTO bugs (app_id, app_name, title, severity, description, steps, device, tester)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [appId, appName, title, severity, description, steps, device, tester || 'Anonymous']
  );
  res.status(201).json(result.rows[0]);
});

app.get('/api/bugs/:appId', async (req, res) => {
  const result = await pool.query('SELECT * FROM bugs WHERE app_id = $1 ORDER BY created_at DESC', [req.params.appId]);
  res.json(result.rows);
});

app.get('/api/bugs', async (req, res) => {
  const result = await pool.query('SELECT * FROM bugs ORDER BY created_at DESC');
  res.json(result.rows);
});

app.patch('/api/bugs/:id/status', async (req, res) => {
  const { status } = req.body;
  const result = await pool.query('UPDATE bugs SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
  res.json(result.rows[0]);
});

// ========== STATS ==========
app.get('/api/stats', async (req, res) => {
  const users = await pool.query('SELECT COUNT(*) FROM users');
  const apps = await pool.query('SELECT COUNT(*) FROM apps');
  const bugs = await pool.query('SELECT COUNT(*) FROM bugs');
  const earnings = await pool.query('SELECT SUM(earnings) FROM users');
  res.json({
    totalUsers: parseInt(users.rows[0].count),
    totalApps: parseInt(apps.rows[0].count),
    totalBugs: parseInt(bugs.rows[0].count),
    totalEarnings: parseFloat(earnings.rows[0].sum) || 0
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ========== BACKUP (optional, remove if not needed) ==========
app.get('/admin/backup-sql', async (req, res) => {
  if (req.query.password !== 'YourPassword123') return res.status(403).json({ error: 'Unauthorized' });
  
  const users = await pool.query('SELECT * FROM users');
  const apps = await pool.query('SELECT * FROM apps');
  const bugs = await pool.query('SELECT * FROM bugs');
  
  let sql = `-- Backup ${new Date().toISOString()}\n`;
  sql += `TRUNCATE users, apps, bugs RESTART IDENTITY CASCADE;\n\n`;
  
  users.rows.forEach(u => {
    sql += `INSERT INTO users (id, full_name, email, type, devices, interests, source, earnings, created_at) VALUES (${u.id}, '${u.full_name}', '${u.email}', '${u.type}', '${JSON.stringify(u.devices)}', '${JSON.stringify(u.interests)}', '${u.source}', ${u.earnings}, '${u.created_at}');\n`;
  });
  
  res.setHeader('Content-Disposition', 'attachment; filename=backup.sql');
  res.setHeader('Content-Type', 'application/sql');
  res.send(sql);
});

// ========== 404 HANDLER ==========
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// ========== START SERVER ==========
app.listen(port, '0.0.0.0', () => {
  console.log(`\n🚀 Server running on port ${port}`);
  console.log(`🌍 http://localhost:${port}\n`);
});