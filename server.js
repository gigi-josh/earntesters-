require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// ========== RENDER.COM POSTGRESQL CONNECTION ==========
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render.com
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(__dirname));

// ========== DATABASE INITIALIZATION ==========
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('📦 Creating database tables...');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL,
        devices TEXT[] DEFAULT '{}',
        interests TEXT[] DEFAULT '{}',
        source VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Users table ready');

    // Create apps table
    await client.query(`
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
      )
    `);
    console.log('✅ Apps table ready');

    // Create bugs table
    await client.query(`
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
      )
    `);
    console.log('✅ Bugs table ready');

    // Create indexes for better performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_bugs_app_id ON bugs(app_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_bugs_status ON bugs(status)');
    
    console.log('✅ Indexes created');

    // Insert sample apps if none exist
    const appsCount = await client.query('SELECT COUNT(*) FROM apps');
    if (parseInt(appsCount.rows[0].count) === 0) {
      console.log('📱 Inserting sample apps...');
      
      const sampleApps = [
        ['FitTrack Pro', '🏃', 'Fitness', '$2.00 flat', 'Mobile App', 'No URL'],
        ['Puzzle Quest', '🎮', 'Gaming', '$0.15 per bug', 'Mobile Game', 'No URL'],
        ['BudgetWise', '💰', 'Finance', '$3.00 flat', 'Mobile App', 'No URL'],
        ['ChatConnect', '💬', 'Social', '$0.10 per bug', 'Web App', 'No URL'],
        ['WeatherLive', '☀️', 'Weather', '$1.50 flat', 'Mobile App', 'No URL'],
        ['Aflame Ministries Int.', 'aflameb.png', 'Church', '$0.08 per bug', 'Website', 'https://church-website-qxh5.onrender.com'],
        ['FoodDash', '🍔', 'Food', '$2.50 flat', 'Mobile App', 'No URL'],
        ['MelodyPlayer', '🎵', 'Music', '$0.12 per bug', 'Mobile App', 'No URL'],
        ['HabitHero', '✅', 'Productivity', '$1.75 flat', 'Mobile App', 'No URL']
      ];

      for (const app of sampleApps) {
        await client.query(
          `INSERT INTO apps (name, icon, category, pay, type, url) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          app
        );
      }
      console.log('✅ Sample apps inserted');
    }

  } catch (error) {
    console.error('❌ Error creating tables:', error);
  } finally {
    client.release();
  }
}

// ========== TEST DATABASE CONNECTION ==========
pool.connect(async (err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    return;
  }
  
  console.log('✅ Connected to Render PostgreSQL successfully');
  
  // Create tables when server starts
  await initializeDatabase();
  
  release();
});

// ========== API ROUTES ==========

// Root route - serve tester.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'tester.html'));
});

// SIGNUP ENDPOINT
app.post('/new', async (req, res) => {
  try {
    const { full_name, email, type, devices, interests, source } = req.body;
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        error: 'User with this email already exists' 
      });
    }
    
    // Insert new user
    const result = await pool.query(
      `INSERT INTO users (full_name, email, type, devices, interests, source, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, full_name, email, type, created_at`,
      [full_name, email, type, devices || [], interests || [], source || '']
    );
    
    console.log(`✅ New user signed up: ${full_name} (${email})`);
    
    res.status(201).json({
      success: true,
      user: result.rows[0],
      redirect: type === 'Tester' ? 'tester-dash.html' : 'developer-dash.html'
    });
    
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET all users
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, type, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET all apps
app.get('/test', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM apps ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching apps:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST new app
app.post('/api/test', async (req, res) => {
  try {
    const { 
      name, icon, category, pay, type, 
      platform, testFocus, screenshot, developer, url 
    } = req.body;
    
    const result = await pool.query(
      `INSERT INTO apps (name, icon, category, pay, type, platform, test_focus, screenshot, developer, url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING *`,
      [
        name, 
        icon || '📱', 
        category, 
        pay, 
        type || 'Mobile App',
        platform || 'Android & iOS',
        testFocus || [],
        screenshot || null,
        developer || 'Unknown',
        url || 'No URL'
      ]
    );
    
    console.log(`📱 New app added: ${name}`);
    res.status(201).json(result.rows[0]);
    
  } catch (error) {
    console.error('Error adding app:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET single app
app.get('/api/apps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM apps WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'App not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching app:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST new bug report
app.post('/api/bugs', async (req, res) => {
  try {
    const { 
      appId, appName, title, severity, description, 
      steps, device, screenshot, tester 
    } = req.body;
    
    const result = await pool.query(
      `INSERT INTO bugs (app_id, app_name, title, severity, description, steps, device, screenshot, tester, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [appId, appName, title, severity, description, steps, device, screenshot, tester || 'Anonymous']
    );
    
    console.log(`🐛 New bug reported for app ${appName}`);
    res.status(201).json(result.rows[0]);
    
  } catch (error) {
    console.error('Error reporting bug:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET bugs for a specific app
app.get('/api/bugs/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const result = await pool.query(
      'SELECT * FROM bugs WHERE app_id = $1 ORDER BY created_at DESC',
      [appId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bugs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET all bugs
app.get('/api/bugs', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bugs ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bugs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update bug status
app.patch('/api/bugs/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'reviewing', 'fixed', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const result = await pool.query(
      'UPDATE bugs SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bug not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating bug:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard stats
app.get('/api/stats', async (req, res) => {
  try {
    const usersCount = await pool.query('SELECT COUNT(*) FROM users');
    const appsCount = await pool.query('SELECT COUNT(*) FROM apps');
    const bugsCount = await pool.query('SELECT COUNT(*) FROM bugs');
    const pendingBugs = await pool.query("SELECT COUNT(*) FROM bugs WHERE status = 'pending'");
    
    res.json({
      totalUsers: parseInt(usersCount.rows[0].count),
      totalApps: parseInt(appsCount.rows[0].count),
      totalBugs: parseInt(bugsCount.rows[0].count),
      pendingBugs: parseInt(pendingBugs.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'connected',
    port: port
  });
});

// ========== STATIC FILES ==========
// Serve HTML files directly
app.get('/tester-dash.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'tester-dash.html'));
});

app.get('/developer-dash.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'developer-dash.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// ========== 404 HANDLER ==========
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// ========== ERROR HANDLING ==========
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ========== START SERVER ==========
app.listen(port, '0.0.0.0', () => {
  console.log('\n🚀 ==================================');
  console.log(`🚀 Express server running on port ${port}`);
  console.log('🚀 ==================================\n');
  console.log(`📊 Database: Render PostgreSQL`);
  console.log(`🌍 Health check: /health`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
});