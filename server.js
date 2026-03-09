const http = require('http');
const fs = require('fs');
const path = require('path');
let nextBugId = 1;

const users = [];
// Apps array (existing data)
const apps = [
    { id: 1, name: "FitTrack Pro", icon: "🏃", category: "Fitness", pay: "$2.00 flat", type: "Mobile App",
        url: "No URL"
    },
    { id: 2, name: "Puzzle Quest", icon: "🎮", category: "Gaming", pay: "$0.15 per bug", type: "Mobile Game",
        url: "No URL" },
    { id: 3, name: "BudgetWise", icon: "💰", category: "Finance", pay: "$3.00 flat", type: "Mobile App", url: "No URL" },
    { id: 4, name: "ChatConnect", icon: "💬", category: "Social", pay: "$0.10 per bug", type: "Web App", url: "No URL" },
    { id: 5, name: "WeatherLive", icon: "☀️", category: "Weather", pay: "$1.50 flat", type: "Mobile App", url: "No URL" },
    { id: 6, name: "Aflame Ministries Int.", icon: "aflameb.png", category: "Church", pay: "$0.08 per bug", type: "Website", url: "https://church-website-qxh5.onrender.com" },
    { id: 7, name: "FoodDash", icon: "🍔", category: "Food", pay: "$2.50 flat", type: "Mobile App", url: "No URL" },
    { id: 8, name: "MelodyPlayer", icon: "🎵", category: "Music", pay: "$0.12 per bug", type: "Mobile App", url: "No URL" },
    { id: 9, name: "HabitHero", icon: "✅", category: "Productivity", pay: "$1.75 flat", type: "Mobile App", url: "No URL" }
];
let nextAppId = apps.length + 1;

let bugs = [];

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // ==================== API ROUTES ====================
    
    // SIGNUP ENDPOINT - Updated to match frontend
    if (req.url === '/new' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const userData = JSON.parse(body);
                
                // Map frontend fields to your user object
                const newUser = {
                    full_name: userData.full_name,  // from frontend
                    email: userData.email,          // from frontend
                    type: userData.type,            // from frontend (personality)
                    devices: userData.devices || [], // from frontend
                    interests: userData.interests || [], // from frontend
                    source: userData.source || '',   // from frontend
                    created_at: new Date().toISOString()
                };
                
                users.push(newUser);
                console.log(`✅ New user signed up: ${newUser.full_name} (${newUser.email}) - Total users: ${users.length}`);
                
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    user: newUser,
                    redirect: newUser.type === 'Tester' ? 'tester-dash.html' : 'developer-dash.html'
                }));
            } catch (error) {
                console.error('Signup error:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({error: 'Invalid JSON'}));
            }
        });
        return;
    }
    
    // POST new app (with base64 screenshot)
    if (req.url === '/api/test' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const appData = JSON.parse(body);
                
                const newApp = {
                    id: nextAppId++,
                    name: appData.name,
                    icon: appData.icon || '📱',
                    category: appData.category,
                    pay: appData.pay,
                    type: appData.type || 'Mobile App',
                    platform: appData.platform || 'Android & iOS',
                    testFocus: appData.testFocus || [],
                    screenshot: appData.screenshot || null,
                    developer: appData.developer || 'Unknown',
                    createdAt: new Date().toISOString()
                };
                
                apps.push(newApp);
                console.log(`📱 New app added: ${newApp.name} (Total: ${apps.length})`);
                
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(newApp));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }
    
    // GET all apps (test endpoint)
    if (req.url === '/test' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(apps));
        return;
    }
    
    // GET single app
    if (req.url.startsWith('/api/apps/') && req.method === 'GET') {
        const id = parseInt(req.url.split('/').pop());
        const app = apps.find(a => a.id === id);
        
        if (app) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(app));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'App not found' }));
        }
        return;
    }
    
    // POST new bug report
    if (req.url === '/api/bugs' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const bugData = JSON.parse(body);
                
                const newBug = {
                    id: nextBugId++,
                    appId: bugData.appId,
                    appName: bugData.appName,
                    title: bugData.title,
                    severity: bugData.severity,
                    description: bugData.description,
                    steps: bugData.steps,
                    device: bugData.device,
                    screenshot: bugData.screenshot || null,
                    tester: bugData.tester || 'Anonymous',
                    status: 'pending',
                    createdAt: new Date().toISOString()
                };
                
                bugs.push(newBug);
                console.log(`🐛 New bug reported for app ${newBug.appId} (Total: ${bugs.length})`);
                
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(newBug));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // GET bugs for an app
    if (req.url.startsWith('/api/bugs/') && req.method === 'GET') {
        const appId = parseInt(req.url.split('/').pop());
        const appBugs = bugs.filter(b => b.appId === appId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(appBugs));
        return;
    }

    // GET all bugs
    if (req.url === '/api/bugs' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(bugs));
        return;
    }

    // ==================== STATIC FILES ====================
    
    let filePath = req.url === '/' 
        ? path.join(__dirname, 'tester.html') 
        : path.join(__dirname, req.url);
    
    const ext = path.extname(filePath);
    const types = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.json': 'application/json'
    };
    
    fs.readFile(filePath, (error, data) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('404 - File Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('500 - Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
            res.end(data);
        }
    });
});

server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log('🚀 Server running at http://localhost:3000');
    console.log(`📱 Apps in memory: ${apps.length}`);
    console.log(`🐛 Bugs in memory: ${bugs.length}`);
    console.log(`👤 Users signed up: ${users.length}`);
    console.log('\n📌 Endpoints:');
    console.log('   POST /new - User signup (matches frontend)');
    console.log('   GET  /test - View all apps');
    console.log('   POST /api/test - Add new app');
    console.log('   POST /api/bugs - Report bug');
    console.log('   GET  /api/bugs - View all bugs');
});