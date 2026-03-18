// tester-dash.js
// API configuration - Uses current origin (works on localhost and Render)
const API_BASE_URL = window.location.origin;
let allTasks = []; // Store all tasks for filtering
let currentUser = {
    id: null,
    name: 'Guest',
    balance: 0.00
};

// Fetch user data from localStorage or session
function loadUserData() {
    const userData = localStorage.getItem('currentUser');
    if (userData) {
        currentUser = JSON.parse(userData);
        updateUserBalance();
    }
}

// Fetch tasks from server (apps endpoint)
async function fetchTasks() {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/test`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const apps = await response.json();
        
        // Convert apps to task format
        allTasks = convertAppsToTasks(apps);
        
        // Apply initial filters
        filterTasks();
        updateAvailableCount(allTasks.length);
        
        // Fetch additional stats if available
        fetchStats();
        
    } catch (error) {
        console.error('Error fetching tasks:', error);
        showError('Failed to load tasks from server. Please try again later.');
    }
}

// Fetch dashboard statistics
async function fetchStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/stats`);
        if (response.ok) {
            const stats = await response.json();
            updateStats(stats);
        }
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

// Update statistics display
function updateStats(stats) {
    const testersOnline = document.getElementById('testers-online');
    if (testersOnline) {
        // Use total users as online count (you can modify this logic)
        testersOnline.textContent = stats.totalUsers || 143;
    }
}

// Convert apps from your database to task format
function convertAppsToTasks(apps) {
    return apps.map((app, index) => {
        // Parse pay amount from string like "$2.00 flat" or "$0.15 per bug"
        let payAmount = 0;
        let payType = 'flat';
        
        if (app.pay) {
            const match = app.pay.match(/\$?([0-9.]+)/);
            if (match) {
                payAmount = parseFloat(match[1]);
            }
            payType = app.pay.includes('per bug') ? 'per bug' : 'flat';
        }
        
        // Determine device types based on platform
        const device = [];
        if (app.platform) {
            const platform = app.platform.toLowerCase();
            if (platform.includes('android')) device.push('Android');
            if (platform.includes('ios') || platform.includes('iphone')) device.push('iPhone');
            if (platform.includes('desktop') || platform.includes('web')) device.push('Desktop');
            if (platform.includes('mobile')) device.push('Mobile');
            if (platform.includes('tablet')) device.push('Tablet');
        } else {
            // Default based on app type
            if (app.type) {
                const type = app.type.toLowerCase();
                if (type.includes('mobile')) {
                    device.push('Android', 'iPhone');
                } else if (type.includes('web') || type.includes('website')) {
                    device.push('Desktop', 'Mobile');
                } else {
                    device.push('Any');
                }
            } else {
                device.push('Any');
            }
        }
        
        // Remove duplicates
        const uniqueDevices = [...new Set(device)];
        
        // Generate spots left (random for now - you should add this to your database)
        const spotsLeft = Math.floor(Math.random() * 15) + 1;
        
        // Build description
        let description = app.test_focus && app.test_focus.length > 0 
            ? `Test focus: ${app.test_focus.join(', ')}. `
            : '';
        
        description += `Test the ${app.name} ${app.type || 'app'} and report any bugs you find.`;
        
        // If there's a URL, add it to description
        if (app.url && app.url !== 'No URL' && app.url !== null) {
            description += `\n\nApp URL: ${app.url}`;
        }
        
        // Determine if featured (you can modify this logic)
        const featured = app.featured === true || (app.id <= 3);
        
        return {
            id: app.id,
            title: app.name,
            description: description,
            category: app.category || 'General',
            payType: payType,
            payAmount: payAmount,
            device: uniqueDevices,
            duration: '15-30 min', // Default duration - you can add this to your database
            spotsLeft: spotsLeft,
            featured: featured,
            createdAt: app.created_at || new Date().toISOString(),
            icon: app.icon || '📱',
            type: app.type || 'App',
            url: app.url || null,
            developer: app.developer || 'Unknown',
            platform: app.platform || 'Cross-platform'
        };
    });
}

// Create task card HTML
function createTaskCard(task) {
    const payDisplay = task.payType === 'per bug' 
        ? `$${task.payAmount.toFixed(2)} <small>per bug</small>`
        : `$${task.payAmount.toFixed(2)} <small>flat</small>`;

    // Create device/platform icons based on task.device
    const deviceIcons = task.device.map(device => {
        const icons = {
            'Desktop': '🖥️',
            'Mobile': '📱',
            'Android': '🤖',
            'iPhone': '🍎',
            'iPad': '📱',
            'Tablet': '📱',
            'Any': '🌐'
        };
        return `<span>${icons[device] || '📱'} ${device}</span>`;
    }).join('');

    // Add URL indicator if present
    const urlIndicator = task.url && task.url !== 'No URL' && task.url !== null 
        ? '<span class="url-indicator" title="Click to open app">🔗 Live App</span>' 
        : '';

    return `
        <div class="task-card" data-task-id="${task.id}" 
             data-category="${task.category}" 
             data-device="${task.device.join(',')}" 
             data-featured="${task.featured}"
             data-pay="${task.payAmount}">
            <div class="task-header">
                <span class="task-category">${task.category}</span>
                <span class="task-pay">${payDisplay}</span>
            </div>
            <div class="task-body">
                <h3 class="task-title">
                    ${task.icon} ${task.title}
                    ${urlIndicator}
                </h3>
                <p class="task-description">${task.description.replace(/\n/g, '<br>')}</p>
                <div class="task-meta">
                    ${deviceIcons}
                    <span>⏱️ ${task.duration}</span>
                    <span>📱 ${task.type}</span>
                </div>
            </div>
            <div class="task-footer">
                <span class="spots-left"><strong>${task.spotsLeft}</strong> spots left</span>
                <button class="task-button" onclick="startTask(${task.id})">Start Testing</button>
            </div>
        </div>
    `;
}

// Render tasks to grid
function renderTasks(tasks, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    if (tasks.length === 0) {
        grid.innerHTML = '<div class="no-tasks">No tasks available</div>';
        return;
    }

    grid.innerHTML = tasks.map(task => createTaskCard(task)).join('');
}

// Filter and search tasks
function filterTasks() {
    const categoryFilter = document.getElementById('category-filter')?.value || 'All Categories';
    const deviceFilter = document.getElementById('device-filter')?.value || 'Any Device';
    const sortFilter = document.getElementById('sort-filter')?.value || 'Sort by: Newest';
    const searchQuery = document.getElementById('search-input')?.value?.toLowerCase().trim() || '';

    let filteredTasks = [...allTasks];

    // Apply category filter
    if (categoryFilter !== 'All Categories') {
        filteredTasks = filteredTasks.filter(task => 
            task.category.toLowerCase() === categoryFilter.toLowerCase()
        );
    }

    // Apply device filter
    if (deviceFilter !== 'Any Device') {
        filteredTasks = filteredTasks.filter(task => 
            task.device.some(d => 
                d.toLowerCase().includes(deviceFilter.toLowerCase()) || 
                d === 'Any'
            )
        );
    }

    // Apply search filter (minimum 3 characters)
    if (searchQuery.length >= 3) {
        filteredTasks = filteredTasks.filter(task => 
            task.title.toLowerCase().includes(searchQuery) ||
            task.description.toLowerCase().includes(searchQuery) ||
            task.category.toLowerCase().includes(searchQuery) ||
            (task.developer && task.developer.toLowerCase().includes(searchQuery))
        );
    }

    // Apply sorting
    switch(sortFilter) {
        case 'Highest Pay':
            filteredTasks.sort((a, b) => b.payAmount - a.payAmount);
            break;
        case 'Most Spots Left':
            filteredTasks.sort((a, b) => b.spotsLeft - a.spotsLeft);
            break;
        default: // Newest
            filteredTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Split into featured and regular tasks
    const featuredTasks = filteredTasks.filter(task => task.featured);
    const regularTasks = filteredTasks.filter(task => !task.featured);

    // Render both grids
    renderTasks(featuredTasks, 'featured-tasks-grid');
    renderTasks(regularTasks, 'all-tasks-grid');

    // Update available count
    updateAvailableCount(filteredTasks.length);
}

// Update available tasks count
function updateAvailableCount(count) {
    const countElement = document.getElementById('available-count');
    if (countElement) {
        countElement.textContent = count;
    }
}

// Update user balance
function updateUserBalance() {
    const balanceElement = document.getElementById('user-balance');
    if (balanceElement && currentUser) {
        balanceElement.textContent = `$${currentUser.balance.toFixed(2)}`;
    }
}

// Show loading state
function showLoading() {
    const featuredGrid = document.getElementById('featured-tasks-grid');
    const allGrid = document.getElementById('all-tasks-grid');
    
    if (featuredGrid) {
        featuredGrid.innerHTML = '<div class="loading-indicator">Loading featured tasks...</div>';
    }
    if (allGrid) {
        allGrid.innerHTML = '<div class="loading-indicator">Loading tasks...</div>';
    }
}

// Show error message
function showError(message) {
    const featuredGrid = document.getElementById('featured-tasks-grid');
    const allGrid = document.getElementById('all-tasks-grid');
    
    const errorDiv = `<div class="error-message">${message}</div>`;
    
    if (featuredGrid) {
        featuredGrid.innerHTML = errorDiv;
    }
    if (allGrid) {
        allGrid.innerHTML = errorDiv;
    }
}

// Start a task
async function startTask(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (task) {
        // Check if user is logged in
        if (!currentUser.id) {
            // Redirect to login/signup
            window.location.href = 'tester.html';
            return;
        }
        
        // Store current task in session
        sessionStorage.setItem('currentTask', JSON.stringify(task));
        
        // Redirect to task details page or open task interface
        if (task.url && task.url !== 'No URL' && task.url !== null) {
            // Open the app URL in a new tab
            window.open(task.url, '_blank');
            
            // Redirect to bug reporting page
            window.location.href = `report-bug.html?taskId=${taskId}`;
        } else {
            // Redirect to task interface
            window.location.href = `task-details.html?id=${taskId}`;
        }
    }
}

// Show all featured tasks
function showAllFeatured(e) {
    if (e) e.preventDefault();
    
    document.getElementById('category-filter').value = 'All Categories';
    document.getElementById('device-filter').value = 'Any Device';
    document.getElementById('sort-filter').value = 'Sort by: Newest';
    document.getElementById('search-input').value = '';
    
    filterTasks();
}

// Refresh tasks
async function refreshTasks() {
    await fetchTasks();
}

// Initialize event listeners
function initializeEventListeners() {
    // Filter button click
    const filterBtn = document.getElementById('filter-btn');
    if (filterBtn) {
        filterBtn.addEventListener('click', filterTasks);
    }
    
    // Real-time search with debounce
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (e.target.value.length >= 3 || e.target.value.length === 0) {
                    filterTasks();
                }
            }, 500);
        });
        
        // Enter key press
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                filterTasks();
            }
        });
    }
    
    // Filter select changes
    const categoryFilter = document.getElementById('category-filter');
    const deviceFilter = document.getElementById('device-filter');
    const sortFilter = document.getElementById('sort-filter');
    
    if (categoryFilter) categoryFilter.addEventListener('change', filterTasks);
    if (deviceFilter) deviceFilter.addEventListener('change', filterTasks);
    if (sortFilter) sortFilter.addEventListener('change', filterTasks);
    
    // View all featured click
    const viewAllLink = document.querySelector('.view-all');
    if (viewAllLink) {
        viewAllLink.addEventListener('click', showAllFeatured);
    }
    
    // Auto-refresh every 5 minutes
    setInterval(refreshTasks, 300000);
}

// Initialize the dashboard
async function initializeDashboard() {
    loadUserData();
    initializeEventListeners();
    await fetchTasks();
}

// Start when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeDashboard);

// Export functions for global use
window.startTask = startTask;
window.showAllFeatured = showAllFeatured;
window.refreshTasks = refreshTasks;