// tester-dash.js
let allApps = [];
let filteredApps = [];
let currentUser = null;

// Load tasks on page load
document.addEventListener('DOMContentLoaded', async function() {
    await fetchCurrentUser();
    await loadApps();
    setupEventListeners();
});

async function fetchCurrentUser() {
    try {
        const response = await fetch('/api/me');
        if (response.ok) {
            currentUser = await response.json();
            displayUserEarnings();
            console.log('Current user:', currentUser);
        }
    } catch (error) {
        console.error('Error fetching user:', error);
    }
}

async function displayUserEarnings() {
    if (!currentUser || !currentUser.id) return;
    
    try {
        const response = await fetch(`/api/earnings/${currentUser.id}`);
        if (response.ok) {
            const data = await response.json();
            const earningsAmount = data.earnings || 0;
            
            // Update balance in header
            const balanceEl = document.querySelector('.balance');
            if (balanceEl) {
                balanceEl.textContent = `$${earningsAmount.toFixed(2)}`;
            }
            
            // Update earnings stat
            const earnedTotal = document.getElementById('earnedTotal');
            if (earnedTotal) {
                earnedTotal.textContent = `$${earningsAmount.toFixed(2)}`;
            }
        }
    } catch (error) {
        console.error('Error fetching earnings:', error);
    }
}

function setupEventListeners() {
    const filterBtn = document.getElementById('filterBtn');
    if (filterBtn) filterBtn.addEventListener('click', filterApps);
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', handleSearchInput);
    
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) categoryFilter.addEventListener('change', filterApps);
    
    const deviceFilter = document.getElementById('deviceFilter');
    if (deviceFilter) deviceFilter.addEventListener('change', filterApps);
    
    const sortFilter = document.getElementById('sortFilter');
    if (sortFilter) sortFilter.addEventListener('change', filterApps);
}

async function loadApps() {
    try {
        const response = await fetch('/test');
        const apps = await response.json();
        
        console.log('Apps loaded:', apps);
        allApps = apps;
        filteredApps = apps;
        
        // Update available count
        const availableCount = document.getElementById('availableCount');
        if (availableCount) availableCount.textContent = apps.length;
        
        // Display tasks
        displayFeaturedTasks();
        displayAllTasks();
        
    } catch (error) {
        console.error('Error loading apps:', error);
        const featuredGrid = document.getElementById('featuredGrid');
        const allTasksGrid = document.getElementById('allTasksGrid');
        
        if (featuredGrid) {
            featuredGrid.innerHTML = '<div class="error">❌ Failed to load tasks</div>';
        }
        if (allTasksGrid) {
            allTasksGrid.innerHTML = '<div class="error">❌ Failed to load tasks</div>';
        }
    }
}

function displayFeaturedTasks() {
    const grid = document.getElementById('featuredGrid');
    if (!grid) return;
    
    const featuredApps = allApps.slice(0, 3);
    
    if (featuredApps.length === 0) {
        grid.innerHTML = '<div class="no-tasks">No featured tasks available</div>';
        return;
    }
    
    grid.innerHTML = featuredApps.map(app => createTaskCard(app)).join('');
}

function displayAllTasks() {
    const grid = document.getElementById('allTasksGrid');
    if (!grid) return;
    
    if (filteredApps.length === 0) {
        grid.innerHTML = '<div class="no-tasks">No tasks match your filters</div>';
        return;
    }
    
    grid.innerHTML = filteredApps.map(app => createTaskCard(app)).join('');
}

function createTaskCard(app) {
    const hasUrl = app.url && app.url !== 'No URL';
    
    // Determine testing page based on type
    let testingPage = 'testing-app.html';
    if (app.type && app.type.toLowerCase().includes('website')) {
        testingPage = 'testing-web.html';
    } else if (app.type && app.type.toLowerCase().includes('game')) {
        testingPage = 'test-game.html';
    } else if (app.type && app.type.toLowerCase().includes('mobile')) {
        testingPage = 'test-mobile.html';
    }
    
    return `
        <div class="task-card" data-app-id="${app.id}">
            <div class="task-header">
                <span class="task-category">${escapeHtml(app.category) || 'General'}</span>
                <span class="task-pay">${escapeHtml(app.pay) || '$$$'}</span>
            </div>
            <div class="task-body">
                <div class="task-title">
                    ${escapeHtml(app.name)}
                    ${hasUrl ? '<span class="url-indicator">🔗 Live URL</span>' : ''}
                </div>
                <div class="task-description">
                    Test this ${escapeHtml(app.type) || 'app'} and find bugs to earn money.
                </div>
                <div class="task-meta">
                    <span>📱 ${escapeHtml(app.platform) || 'Android & iOS'}</span>
                    <span>⏱️ Various test cases</span>
                </div>
            </div>
            <div class="task-footer">
                <div class="spots-left">
                    <strong>${Math.floor(Math.random() * 20) + 5}</strong> spots left
                </div>
                <button class="task-button" onclick="startTesting(${app.id}, '${testingPage}')">
                    Start Testing
                </button>
            </div>
        </div>
    `;
}

function startTesting(appId, testingPage) {
    console.log(`Starting test for app ${appId}`);
    window.location.href = `${testingPage}?appId=${appId}`;
}

function showAllTasks() {
    const allTasksGrid = document.getElementById('allTasksGrid');
    if (allTasksGrid) {
        allTasksGrid.scrollIntoView({ behavior: 'smooth' });
    }
}

function handleSearchInput(e) {
    const searchTerm = e.target.value.toLowerCase();
    if (searchTerm.length >= 3 || searchTerm.length === 0) {
        filterApps();
    }
}

function filterApps() {
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const deviceFilter = document.getElementById('deviceFilter');
    const sortFilter = document.getElementById('sortFilter');
    
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const category = categoryFilter ? categoryFilter.value : 'All Categories';
    const device = deviceFilter ? deviceFilter.value : 'Any Device';
    const sortBy = sortFilter ? sortFilter.value : 'Newest First';
    
    filteredApps = allApps.filter(app => {
        if (searchTerm && !app.name.toLowerCase().includes(searchTerm) && 
            !app.category?.toLowerCase().includes(searchTerm)) {
            return false;
        }
        
        if (category !== 'All Categories' && app.category !== category) {
            return false;
        }
        
        if (device !== 'Any Device') {
            if (device === 'Mobile' && app.type === 'Website') return false;
            if (device === 'Desktop' && app.type === 'Mobile App') return false;
            if (device === 'Android' && !app.platform?.includes('Android')) return false;
            if (device === 'iOS' && !app.platform?.includes('iOS')) return false;
        }
        
        return true;
    });
    
    if (sortBy === 'Highest Pay') {
        filteredApps.sort((a, b) => {
            const payA = parseFloat(a.pay?.replace(/[^0-9.-]+/g, '')) || 0;
            const payB = parseFloat(b.pay?.replace(/[^0-9.-]+/g, '')) || 0;
            return payB - payA;
        });
    } else if (sortBy === 'Most Spots') {
        filteredApps.sort((a, b) => (b.spots || 0) - (a.spots || 0));
    } else {
        filteredApps.sort((a, b) => (b.id || 0) - (a.id || 0));
    }
    
    displayAllTasks();
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        document.cookie.split(";").forEach(function(c) {
            document.cookie = c.replace(/^ +/, "")
                .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        
        localStorage.clear();
        sessionStorage.clear();
        
        fetch('/api/logout', { method: 'POST' })
            .then(() => {
                window.location.href = '/login.html';
            })
            .catch(() => {
                window.location.href = '/login.html';
            });
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Make functions globally available
window.startTesting = startTesting;
window.showAllTasks = showAllTasks;
window.logout = logout;