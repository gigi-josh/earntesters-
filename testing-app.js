// testing-app.js

// Get appId from URL (tester-dash passes it when redirecting)
const urlParams = new URLSearchParams(window.location.search);
const appId = urlParams.get('appId');

let currentApp = null;
let selectedSeverity = 'low';

// Load app data on page load
document.addEventListener('DOMContentLoaded', async function() {
    if (!appId) {
        showError('No app ID provided. Please return to dashboard.');
        return;
    }
    
    // Show loading state
    showLoading();
    
    // Load app data from server
    await loadAppData();
    
    // Load any existing bugs for this app
    await loadBugsForApp();
});

function showLoading() {
    const appName = document.getElementById('appName');
    const appCategory = document.getElementById('appCategory');
    const appPay = document.getElementById('appPay');
    const appPlatform = document.getElementById('appPlatform');
    const appIcon = document.getElementById('appIcon');
    
    if (appName) appName.textContent = 'Loading...';
    if (appCategory) appCategory.textContent = 'Loading...';
    if (appPay) appPay.textContent = 'Loading...';
    if (appPlatform) appPlatform.textContent = 'Loading...';
    if (appIcon) appIcon.textContent = '⏳';
}

async function loadAppData() {
    try {
        console.log('Fetching app data for ID:', appId);
        
        // Send appId to server to get the app data
        const response = await fetch('/get-from', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: appId })
        });
        
        if (!response.ok) {
            throw new Error('App not found');
        }
        
        const app = await response.json();
        console.log('App data loaded:', app);
        
        currentApp = app;
        displayAppData(app);
        
    } catch (error) {
        console.error('Error loading app:', error);
        showError('Failed to load app data. Please try again.');
    }
}

function displayAppData(app) {
    // Update app info
    const appName = document.getElementById('appName');
    const appCategory = document.getElementById('appCategory');
    const appPay = document.getElementById('appPay');
    const appPlatform = document.getElementById('appPlatform');
    const appIcon = document.getElementById('appIcon');
    const appIdField = document.getElementById('appIdField');
    const fileSize = document.getElementById('fileSize');
    
    if (appName) appName.textContent = app.name || 'Unknown App';
    if (appCategory) appCategory.textContent = app.category || 'General';
    if (appPay) appPay.textContent = app.pay || 'Not specified';
    if (appPlatform) appPlatform.textContent = app.platform || 'All Platforms';
    if (appIcon) appIcon.textContent = app.icon || '📱';
    if (appIdField) appIdField.value = app.id;
    
    // Update file size based on app type
    if (fileSize) {
        if (app.type && app.type.toLowerCase().includes('game')) {
            fileSize.textContent = '124.5';
        } else if (app.type && app.type.toLowerCase().includes('social')) {
            fileSize.textContent = '38.2';
        } else {
            fileSize.textContent = '47.8';
        }
    }
    
    // Update instructions based on app type
    updateInstructions(app.type);
    
    // Update page title
    document.title = `Download ${app.name} - EarnTesters`;
}

function updateInstructions(appType) {
    const instructionsList = document.getElementById('instructionsList');
    if (!instructionsList) return;
    
    let instructions = '';
    
    if (appType && appType.toLowerCase().includes('game')) {
        instructions = `
            <li>Download and install the game</li>
            <li>Test all levels and features</li>
            <li>Check for crashes during gameplay</li>
            <li>Test on different devices</li>
            <li>Report any bugs or glitches</li>
        `;
    } else if (appType && appType.toLowerCase().includes('social')) {
        instructions = `
            <li>Test registration and login</li>
            <li>Check messaging features</li>
            <li>Test image/video uploads</li>
            <li>Verify notifications work</li>
            <li>Report any UI issues</li>
        `;
    } else {
        instructions = `
            <li>Download and install the app</li>
            <li>Test all features thoroughly</li>
            <li>Check for crashes and bugs</li>
            <li>Test on different devices</li>
            <li>Report any issues found</li>
        `;
    }
    
    instructionsList.innerHTML = instructions;
}

function showError(message) {
    const appInfoCard = document.getElementById('appInfoCard');
    if (!appInfoCard) return;
    
    appInfoCard.innerHTML = `
        <div class="error-message" style="padding: 40px; text-align: center; background: white; border-radius: 15px;">
            <h3 style="color: #f44336; margin-bottom: 15px;">❌ Error</h3>
            <p style="color: #666; margin-bottom: 20px;">${message}</p>
            <button onclick="window.location.href='tester-dash.html'" 
                    style="padding: 12px 30px; background: #764ba2; color: white; border: none; border-radius: 8px; cursor: pointer;">
                Back to Dashboard
            </button>
        </div>
    `;
}

function selectSeverity(severity) {
    selectedSeverity = severity;
    
    // Update UI
    document.querySelectorAll('.severity-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    // Add selected class to clicked element
    if (event && event.target) {
        event.target.classList.add('selected');
    }
}

async function submitBug() {
    const title = document.getElementById('bugTitle')?.value;
    
    if (!title) {
        alert('Please enter a bug title');
        return;
    }
    
    if (!currentApp) {
        alert('App data not loaded. Please refresh the page.');
        return;
    }
    
    const description = document.getElementById('bugDescription')?.value || '';
    const steps = document.getElementById('bugSteps')?.value || '';
    const device = document.getElementById('deviceInfo')?.value || 'Unknown';
    
    const bugData = {
        appId: currentApp.id,
        appName: currentApp.name,
        title: title,
        severity: selectedSeverity,
        description: description,
        steps: steps,
        device: device,
        tester: 'Anonymous' // You can replace with actual username from login
    };
    
    try {
        // Disable submit button to prevent double submission
        const submitBtn = event?.target;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }
        
        const response = await fetch('/api/bugs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bugData)
        });
        
        if (response.ok) {
            alert('✅ Bug submitted successfully! It will be reviewed within 24 hours.');
            
            // Clear form
            const bugTitle = document.getElementById('bugTitle');
            const bugDescription = document.getElementById('bugDescription');
            const bugSteps = document.getElementById('bugSteps');
            
            if (bugTitle) bugTitle.value = '';
            if (bugDescription) bugDescription.value = '';
            if (bugSteps) bugSteps.value = '';
            
            // Remove selected severity
            document.querySelectorAll('.severity-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            selectedSeverity = 'low';
            
            // Reload bugs list
            await loadBugsForApp();
            
        } else {
            const error = await response.json();
            alert('❌ Failed to submit bug: ' + (error.error || 'Unknown error'));
        }
        
    } catch (error) {
        console.error('Error submitting bug:', error);
        alert('❌ Error submitting bug. Please check your connection and try again.');
    } finally {
        // Re-enable submit button
        const submitBtn = event?.target;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Bug Report';
        }
    }
}

async function loadBugsForApp() {
    if (!appId) return;
    
    try {
        const response = await fetch(`/api/bugs/${appId}`);
        const bugs = await response.json();
        
        const bugsList = document.getElementById('submittedBugsList');
        if (!bugsList) return;
        
        if (!bugs || bugs.length === 0) {
            bugsList.innerHTML = `
                <h3>Your Submitted Bugs</h3>
                <div style="text-align: center; color: #999; padding: 20px;">
                    No bugs submitted yet
                </div>
            `;
            return;
        }
        
        let bugsHtml = '<h3>Your Submitted Bugs</h3>';
        
        bugs.forEach(bug => {
            // Determine severity class
            const severityLower = (bug.severity || '').toLowerCase();
            let severityClass = 'low';
            if (severityLower.includes('high')) severityClass = 'high';
            else if (severityLower.includes('medium')) severityClass = 'medium';
            
            // Format date
            const date = bug.created_at ? new Date(bug.created_at).toLocaleString() : 'Unknown date';
            
            bugsHtml += `
                <div class="bug-item ${severityClass}" style="
                    background: #f9f9f9;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 10px;
                    border-left: 4px solid ${severityClass === 'high' ? '#f44336' : (severityClass === 'medium' ? '#ff9800' : '#4caf50')};
                ">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong>${bug.title || 'Untitled'}</strong>
                        <span style="
                            padding: 3px 8px;
                            border-radius: 12px;
                            font-size: 11px;
                            background: ${bug.status === 'pending' ? '#ff9800' : (bug.status === 'fixed' ? '#4caf50' : '#999')};
                            color: white;
                        ">${bug.status || 'pending'}</span>
                    </div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 5px;">
                        ${bug.description ? bug.description.substring(0, 60) + '...' : 'No description'}
                    </div>
                    <div style="font-size: 11px; color: #999; display: flex; gap: 15px;">
                        <span>${bug.severity || 'Low'}</span>
                        <span>${date}</span>
                    </div>
                </div>
            `;
        });
        
        bugsList.innerHTML = bugsHtml;
        
    } catch (error) {
        console.error('Error loading bugs:', error);
    }
}

function downloadApp(platform) {
    if (!currentApp) {
        alert('App data not loaded');
        return;
    }
    
    // Show download started message
    alert(`📥 Downloading ${currentApp.name} for ${platform}...`);
    
    // Log download for analytics
    console.log(`Download started: ${currentApp.name} (${platform}) - App ID: ${currentApp.id}`);
    
    // In production, you would redirect to actual download URL:
    // window.location.href = `/downloads/${currentApp.id}/${platform}`;
    
    // For demo, simulate download start
    const downloadBtn = event?.target;
    if (downloadBtn) {
        const originalText = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '⬇️ Downloading...';
        downloadBtn.disabled = true;
        
        setTimeout(() => {
            downloadBtn.innerHTML = originalText;
            downloadBtn.disabled = false;
        }, 2000);
    }
}

// Make functions globally available
window.selectSeverity = selectSeverity;
window.submitBug = submitBug;
window.downloadApp = downloadApp;