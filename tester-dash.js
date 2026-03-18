// tester-dash.js
let allApps = [];
let filteredApps = [];

// Load tasks on page load
document.addEventListener('DOMContentLoaded', function() {
    loadApps();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('filter-btn').addEventListener('click', filterApps);
    document.getElementById('search-input').addEventListener('input', handleSearchInput);
    document.getElementById('category-filter').addEventListener('change', filterApps);
    document.getElementById('device-filter').addEventListener('change', filterApps);
    document.getElementById('sort-filter').addEventListener('change', filterApps);
}

async function loadApps() {
    try {
        // Show loading states
        document.getElementById('featured-tasks-grid').innerHTML = '<div class="loading-indicator">Loading featured tasks...</div>';
        document.getElementById('all-tasks-grid').innerHTML = '<div class="loading-indicator">Loading tasks...</div>';
        
        const response = await fetch('/test');
        const apps = await response.json();
        
        console.log('Apps loaded:', apps);
        allApps = apps;
        filteredApps = apps;
        
        // Update available count
        document.getElementById('available-count').textContent = apps.length;
        
        // Display tasks
        displayFeaturedTasks();
        displayAllTasks();
        
    } catch (error) {
        console.error('Error loading apps:', error);
        document.getElementById('featured-tasks-grid').innerHTML = 
            '<div class="error-message">❌ Failed to load tasks. Please try again later.</div>';
        document.getElementById('all-tasks-grid').innerHTML = 
            '<div class="error-message">❌ Failed to load tasks. Please try again later.</div>';
    }
}

function displayFeaturedTasks() {
    const grid = document.getElementById('featured-tasks-grid');
    
    // Take first 3 apps as featured
    const featuredApps = allApps.slice(0, 3);
    
    if (featuredApps.length === 0) {
        grid.innerHTML = '<div class="no-tasks">No featured tasks available</div>';
        return;
    }
    
    grid.innerHTML = featuredApps.map(app => createTaskCard(app)).join('');
}

function displayAllTasks() {
    const grid = document.getElementById('all-tasks-grid');
    
    if (filteredApps.length === 0) {
        grid.innerHTML = '<div class="no-tasks">No tasks match your filters</div>';
        return;
    }
    
    grid.innerHTML = filteredApps.map(app => createTaskCard(app)).join('');
}

function createTaskCard(app) {
    const hasUrl = app.url && app.url !== 'No URL' && app.url !== 'No URL';
    
    // Determine the testing page based on type
    let testingPage = 'test-app.html'; // default
    
    if (app.type && app.type.toLowerCase().includes('website')) {
        testingPage = 'test-website.html';
    } else if (app.type && app.type.toLowerCase().includes('game')) {
        testingPage = 'test-game.html';
    } else if (app.type && app.type.toLowerCase().includes('mobile')) {
        testingPage = 'test-mobile.html';
    } else if (app.type && app.type.toLowerCase().includes('web')) {
        testingPage = 'test-web.html';
    }
    
    return `
        <div class="task-card" data-app-id="${app.id}">
            <div class="task-header">
                <span class="task-category">${app.category || 'General'}</span>
                <span class="task-pay">${app.pay || '$$$'}</span>
            </div>
            <div class="task-body">
                <div class="task-title">
                    ${app.name}
                    ${hasUrl ? '<span class="url-indicator">🔗 Live URL</span>' : ''}
                </div>
                <div class="task-description">
                    Test this ${app.type || 'app'} and find bugs to earn money.
                </div>
                <div class="task-meta">
                    <span>📱 ${app.platform || 'Android & iOS'}</span>
                    <span>⏱️ ${app.testFocus?.length || 'Various'} test cases</span>
                </div>
            </div>
            <div class="task-footer">
                <div class="spots-left">
                    <strong>${Math.floor(Math.random() * 20) + 5}</strong> spots left
                </div>
                <button class="task-button" onclick="startTesting(${app.id}, '${app.type}', '${app.name}', '${hasUrl ? app.url : ''}')">
                    Start Testing
                </button>
            </div>
        </div>
    `;
}

// NEW FUNCTION: Handle start testing button click
function startTesting(appId, appType, appName, appUrl) {
    console.log(`Starting test for app ${appId} (${appType})`);
    
    // Save app info to sessionStorage for the testing page
    sessionStorage.setItem('currentAppId', appId);
    sessionStorage.setItem('currentAppName', appName);
    sessionStorage.setItem('currentAppType', appType);
    sessionStorage.setItem('currentAppUrl', appUrl);
    
    // Determine which page to go to based on app type
    let redirectPage = 'test-app.html'; // default fallback
    
    if (appType) {
        const typeLower = appType.toLowerCase();
        if (typeLower.includes('website') || typeLower.includes('site')) {
            redirectPage = 'test-website.html';
        } else if (typeLower.includes('game')) {
            redirectPage = 'test-game.html';
        } else if (typeLower.includes('mobile')) {
            redirectPage = 'test-mobile.html';
        } else if (typeLower.includes('web app')) {
            redirectPage = 'test-web.html';
        } else if (typeLower.includes('api')) {
            redirectPage = 'test-api.html';
        }
    }
    
    // Add query parameter for extra context
    window.location.href = `${redirectPage}?appId=${appId}&type=${encodeURIComponent(appType)}`;
}

function showAllFeatured() {
    // Scroll to all tasks section
    document.getElementById('all-tasks-grid').scrollIntoView({ behavior: 'smooth' });
}

function handleSearchInput(e) {
    const searchTerm = e.target.value.toLowerCase();
    if (searchTerm.length >= 3 || searchTerm.length === 0) {
        filterApps();
    }
}

function filterApps() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const category = document.getElementById('category-filter').value;
    const device = document.getElementById('device-filter').value;
    const sortBy = document.getElementById('sort-filter').value;
    
    filteredApps = allApps.filter(app => {
        // Search filter
        if (searchTerm && !app.name.toLowerCase().includes(searchTerm) && 
            !app.category?.toLowerCase().includes(searchTerm)) {
            return false;
        }
        
        // Category filter
        if (category !== 'All Categories' && app.category !== category) {
            return false;
        }
        
        // Device filter (simplified)
        if (device !== 'Any Device') {
            if (device === 'Mobile' && app.type === 'Website') return false;
            if (device === 'Desktop' && app.type === 'Mobile App') return false;
        }
        
        return true;
    });
    
    // Sort apps
    if (sortBy === 'Highest Pay') {
        filteredApps.sort((a, b) => {
            const payA = parseFloat(a.pay?.replace(/[^0-9.-]+/g, '')) || 0;
            const payB = parseFloat(b.pay?.replace(/[^0-9.-]+/g, '')) || 0;
            return payB - payA;
        });
    } else if (sortBy === 'Most Spots Left') {
        filteredApps.sort((a, b) => (b.spots || 0) - (a.spots || 0));
    } else {
        // Newest first
        filteredApps.sort((a, b) => (b.id || 0) - (a.id || 0));
    }
    
    displayAllTasks();
}

// Global function for onclick
window.startTesting = startTesting;
window.showAllFeatured = showAllFeatured;