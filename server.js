require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// ========== RENDER.COM POSTGRESQL CONNECTION ==========
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
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
    
    // Create users table with earnings column
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
      )
    `);
    console.log('✅ Users table ready (with earnings column)');

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
    console.log('🎉 Database initialization complete!');

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

// ========== API ROUTES ========

// SQL Backup endpoint - Creates a complete database backup as SQL file
app.get('/admin/backup-sql', async (req, res) => {
    try {
        // Simple password protection to prevent unauthorized access
        const { password } = req.query;
        if (password !== 'YourSecurePassword123') {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        console.log('📦 Generating SQL backup...');
        
        let sql = `-- ========================================\n`;
        sql += `-- EarnTesters Database Backup\n`;
        sql += `-- Generated: ${new Date().toISOString()}\n`;
        sql += `-- ========================================\n\n`;
        
        // ========== 1. BACKUP USERS TABLE ==========
        const users = await pool.query('SELECT * FROM users ORDER BY id');
        sql += `--\n-- Users Table (${users.rows.length} records)\n--\n`;
        
        // First, clear existing data (optional - comment out if not needed)
        sql += `TRUNCATE TABLE users RESTART IDENTITY CASCADE;\n`;
        
        users.rows.forEach(user => {
            // Handle array fields (devices, interests)
            const devices = JSON.stringify(user.devices || []).replace(/'/g, "''");
            const interests = JSON.stringify(user.interests || []).replace(/'/g, "''");
            
            sql += `INSERT INTO users (id, full_name, email, type, devices, interests, source, earnings, created_at) VALUES (`;
            sql += `${user.id}, `;
            sql += `'${(user.full_name || '').replace(/'/g, "''")}', `;
            sql += `'${(user.email || '').replace(/'/g, "''")}', `;
            sql += `'${user.type || 'Tester'}', `;
            sql += `'${devices}', `;
            sql += `'${interests}', `;
            sql += `'${(user.source || '').replace(/'/g, "''")}', `;
            sql += `${user.earnings || 0}, `;
            sql += `'${user.created_at || new Date().toISOString()}');\n`;
        });
        
        sql += `\n-- Reset sequence\n`;
        sql += `SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));\n\n`;
        
        // ========== 2. BACKUP APPS TABLE ==========
        const apps = await pool.query('SELECT * FROM apps ORDER BY id');
        sql += `--\n-- Apps Table (${apps.rows.length} records)\n--\n`;
        
        sql += `TRUNCATE TABLE apps RESTART IDENTITY CASCADE;\n`;
        
        apps.rows.forEach(app => {
            // Handle array field (test_focus)
            const testFocus = JSON.stringify(app.test_focus || []).replace(/'/g, "''");
            
            sql += `INSERT INTO apps (id, name, icon, category, pay, type, platform, test_focus, screenshot, developer, url, created_at) VALUES (`;
            sql += `${app.id}, `;
            sql += `'${(app.name || '').replace(/'/g, "''")}', `;
            sql += `'${(app.icon || '📱').replace(/'/g, "''")}', `;
            sql += `'${(app.category || '').replace(/'/g, "''")}', `;
            sql += `'${(app.pay || '').replace(/'/g, "''")}', `;
            sql += `'${(app.type || 'Mobile App').replace(/'/g, "''")}', `;
            sql += `'${(app.platform || 'Android & iOS').replace(/'/g, "''")}', `;
            sql += `'${testFocus}', `;
            sql += app.screenshot ? `'${app.screenshot.replace(/'/g, "''")}', ` : `NULL, `;
            sql += `'${(app.developer || 'Unknown').replace(/'/g, "''")}', `;
            sql += app.url ? `'${app.url.replace(/'/g, "''")}', ` : `NULL, `;
            sql += `'${app.created_at || new Date().toISOString()}');\n`;
        });
        
        sql += `\n-- Reset sequence\n`;
        sql += `SELECT setval('apps_id_seq', (SELECT MAX(id) FROM apps));\n\n`;
        
        // ========== 3. BACKUP BUGS TABLE ==========
        const bugs = await pool.query('SELECT * FROM bugs ORDER BY id');
        sql += `--\n-- Bugs Table (${bugs.rows.length} records)\n--\n`;
        
        sql += `TRUNCATE TABLE bugs RESTART IDENTITY CASCADE;\n`;
        
        bugs.rows.forEach(bug => {
            sql += `INSERT INTO bugs (id, app_id, app_name, title, severity, description, steps, device, screenshot, tester, status, created_at) VALUES (`;
            sql += `${bug.id}, `;
            sql += `${bug.app_id}, `;
            sql += `'${(bug.app_name || '').replace(/'/g, "''")}', `;
            sql += `'${(bug.title || '').replace(/'/g, "''")}', `;
            sql += `'${(bug.severity || 'low').replace(/'/g, "''")}', `;
            sql += `'${(bug.description || '').replace(/'/g, "''")}', `;
            sql += bug.steps ? `'${bug.steps.replace(/'/g, "''")}', ` : `NULL, `;
            sql += `'${(bug.device || '').replace(/'/g, "''")}', `;
            sql += bug.screenshot ? `'${bug.screenshot.replace(/'/g, "''")}', ` : `NULL, `;
            sql += `'${(bug.tester || 'Anonymous').replace(/'/g, "''")}', `;
            sql += `'${bug.status || 'pending'}', `;
            sql += `'${bug.created_at || new Date().toISOString()}');\n`;
        });
        
        sql += `\n-- Reset sequence\n`;
        sql += `SELECT setval('bugs_id_seq', (SELECT MAX(id) FROM bugs));\n\n`;
        
        sql += `-- ========================================\n`;
        sql += `-- Backup Complete!\n`;
        sql += `-- ========================================\n`;
        
        console.log(`✅ SQL Backup generated: ${users.rows.length} users, ${apps.rows.length} apps, ${bugs.rows.length} bugs`);
        
        // Set headers for file download
        res.setHeader('Content-Disposition', 'attachment; filename=earntesters-backup.sql');
        res.setHeader('Content-Type', 'application/sql');
        
        res.send(sql);
        
    } catch (error) {
        console.error('❌ Backup error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Root route - serve tester.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'tester.html'));
});

// Get current user from cookie/session
app.get('/api/me', async (req, res) => {
  try {
    // Assuming you store userId in cookie
    const userId = req.cookies.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const result = await pool.query(
      'SELECT id, full_name, email, type, earnings FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user earnings
app.get('/api/earnings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query('SELECT earnings FROM users WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ earnings: result.rows[0].earnings || 0 });
  } catch (error) {
    console.error('Error fetching earnings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update earnings when bug is approved
app.post('/api/earnings/add', async (req, res) => {
  try {
    const { userId, amount, bugId } = req.body;
    
    // Start transaction
    await pool.query('BEGIN');
    
    // Update user earnings
    await pool.query(
      'UPDATE users SET earnings = earnings + $1 WHERE id = $2',
      [amount, userId]
    );
    
    // Mark bug as approved if bugId provided
    if (bugId) {
      await pool.query(
        'UPDATE bugs SET status = $1 WHERE id = $2',
        ['approved', bugId]
      );
    }
    
    // Get updated earnings
    const result = await pool.query('SELECT earnings FROM users WHERE id = $1', [userId]);
    
    await pool.query('COMMIT');
    
    res.json({ 
      success: true, 
      earnings: result.rows[0].earnings 
    });
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error adding earnings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's approved bugs with earnings
app.get('/api/user/:userId/earnings-history', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(`
      SELECT id, title, severity, status, created_at,
        CASE 
          WHEN severity = 'high' OR severity LIKE '%High%' THEN 5.00
          WHEN severity = 'medium' OR severity LIKE '%Medium%' THEN 2.50
          WHEN severity = 'low' OR severity LIKE '%Low%' THEN 1.00
          ELSE 0.50
        END as amount
      FROM bugs 
      WHERE tester = $1 AND status = 'approved'
      ORDER BY created_at DESC
    `, [userId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching earnings history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single app by ID
app.post('/get-from', async(req, res) => {
  try {
    const { id } = req.body;
    console.log('Fetching app with ID:', id);
    
    const result = await pool.query('SELECT * FROM apps WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'App not found' });
    }
    
    console.log('App found:', result.rows[0].name);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching app:', err);
    res.status(500).json({ error: "Internal Server error" });
  }
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
    
    // Insert new user with earnings default 0
    const result = await pool.query(
      `INSERT INTO users (full_name, email, type, devices, interests, source, earnings, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0.00, NOW())
       RETURNING id, full_name, email, type, earnings, created_at`,
      [full_name, email, type, devices || [], interests || [], source || '']
    );
    
    console.log(`✅ New user signed up: ${full_name} (${email})`);
    
    // Set cookie
    res.cookie('userId', result.rows[0].id, {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'strict'
    });
    
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

// LOGIN ENDPOINT
app.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    // Find user by email (simplified - add bcrypt later)
    const result = await pool.query(
      'SELECT id, full_name, email, type, earnings FROM users WHERE email = $1',
      [identifier]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Set cookie
    res.cookie('userId', user.id, {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'strict'
    });
    
    res.json({
      success: true,
      user: user,
      redirect: user.type === 'Tester' ? 'tester-dash.html' : 'developer-dash.html'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// LOGOUT ENDPOINT
app.post('/api/logout', (req, res) => {
  res.clearCookie('userId');
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET all users
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, type, earnings, created_at FROM users ORDER BY created_at DESC'
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
    
    const validStatuses = ['pending', 'reviewing', 'approved', 'rejected', 'paid'];
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
    const totalEarnings = await pool.query("SELECT SUM(earnings) FROM users");
    
    res.json({
      totalUsers: parseInt(usersCount.rows[0].count),
      totalApps: parseInt(appsCount.rows[0].count),
      totalBugs: parseInt(bugsCount.rows[0].count),
      pendingBugs: parseInt(pendingBugs.rows[0].count),
      totalEarnings: parseFloat(totalEarnings.rows[0].sum) || 0
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

// ========== STATIC HTML ROUTES ==========
app.get('/tester-dash.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'tester-dash.html'));
});

app.get('/developer-dash.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'developer-dash.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/testing-website.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'testing-website.html'));
});

app.get('/testing-web.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'testing-web.html'));
});

app.get('/testing-app.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'testing-app.html'));
});

app.get('/test-mobile.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-mobile.html'));
});

app.get('/test-game.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-game.html'));
});

app.get('/team.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'team.html'));
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
  console.log('\n📌 Endpoints:');
  console.log('   GET  /api/me                - Get current user');
  console.log('   GET  /api/earnings/:userId  - Get user earnings');
  console.log('   POST /api/earnings/add      - Add earnings');
  console.log('   GET  /api/user/:userId/earnings-history - Earnings history');
  console.log('   POST /get-from               - Get app by ID');
  console.log('   POST /new                    - User signup');
  console.log('   POST /login                   - User login');
  console.log('   POST /api/logout              - Logout');
  console.log('   GET  /users                   - View all users');
  console.log('   GET  /test                     - View all apps');
  console.log('   POST /api/test                 - Add new app');
  console.log('   POST /api/bugs                 - Report bug');
  console.log('   GET  /api/bugs                 - View all bugs');
  console.log('   GET  /api/bugs/:appId          - View bugs for app');
  console.log('   PATCH /api/bugs/:id/status     - Update bug status');
  console.log('   GET  /api/stats                 - Dashboard stats\n');
});