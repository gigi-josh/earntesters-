// testing-web.js

// Get appId from URL
const urlParams = new URLSearchParams(window.location.search);
const appId = urlParams.get('appId');

let currentApp = null;
let selectedSeverity = 'low';

// Load app data on page load
document.addEventListener('DOMContentLoaded', async function() {
  if (!appId) {
    showError('No app ID provided');
    return;
  }
  
  await loadAppData();
  await loadBugsForApp();
});

async function loadAppData() {
  try {
    console.log('Fetching website data for ID:', appId);
    
    const response = await fetch('/get-from', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: appId })
    });
    
    if (!response.ok) {
      throw new Error('Website not found');
    }
    
    const app = await response.json();
    console.log('Website data loaded:', app);
    
    currentApp = app;
    displayWebsiteData(app);
    
  } catch (error) {
    console.error('Error:', error);
    showError('Failed to load website data');
  }
}

function displayWebsiteData(app) {
  // Update app info
  document.getElementById('appName').textContent = app.name || 'Unknown Website';
  document.getElementById('appType').textContent = app.type || 'Website Testing';
  document.getElementById('appIdField').value = app.id;
  
  // Update URLs
  const url = app.url || 'https://example.com';
  document.getElementById('websiteUrl').textContent = url;
  document.getElementById('mobileUrl').textContent = url;
  
  // Load iframes
  const desktopFrame = document.getElementById('websiteFrame');
  const mobileFrame = document.getElementById('mobileFrame');
  
  if (desktopFrame) desktopFrame.src = url;
  if (mobileFrame) mobileFrame.src = url;
  
  // Update instructions based on website type
  updateInstructions(app.category);
  
  // Update page title
  document.title = `Testing ${app.name} - EarnTesters`;
}

function updateInstructions(category) {
  const list = document.getElementById('instructionsList');
  
  let instructions = '';
  
  if (category && category.toLowerCase().includes('ecommerce')) {
    instructions = `
            <li>Test the entire checkout process</li>
            <li>Try adding items to cart</li>
            <li>Test payment methods</li>
            <li>Check order confirmation emails</li>
            <li>Verify discount codes work</li>
        `;
  } else if (category && category.toLowerCase().includes('social')) {
    instructions = `
            <li>Test registration and login</li>
            <li>Try posting content</li>
            <li>Test messaging features</li>
            <li>Check notifications</li>
            <li>Verify profile editing works</li>
        `;
  } else {
    instructions = `
            <li>Test all navigation links</li>
            <li>Check responsive design</li>
            <li>Verify forms work correctly</li>
            <li>Test on different browsers</li>
            <li>Check page load times</li>
        `;
  }
  
  list.innerHTML = instructions;
}

function showError(message) {
  const container = document.querySelector('.test-container');
  if (container) {
    container.innerHTML = `
            <div class="error-message" style="grid-column: 1/-1; padding: 40px;">
                <h3>❌ Error</h3>
                <p>${message}</p>
                <button onclick="window.location.href='tester-dash.html'" 
                        style="margin-top:20px; padding:10px 20px; background:#764ba2; color:white; border:none; border-radius:5px; cursor:pointer;">
                    Back to Dashboard
                </button>
            </div>
        `;
  }
}

function hideLoading() {
  document.querySelector('.browser-content').classList.remove('loading');
}

function refreshPreview() {
  const desktopFrame = document.getElementById('websiteFrame');
  const mobileFrame = document.getElementById('mobileFrame');
  
  if (desktopFrame) desktopFrame.src = desktopFrame.src;
  if (mobileFrame) mobileFrame.src = mobileFrame.src;
}

function toggleDevice(device) {
  document.getElementById('desktopView').classList.remove('active');
  document.getElementById('mobileView').classList.remove('active');
  document.getElementById(device + 'View').classList.add('active');
}

function openInNewTab() {
  if (currentApp && currentApp.url) {
    window.open(currentApp.url, '_blank');
  }
}

function selectSeverity(severity, element) {
  selectedSeverity = severity;
  
  // Remove selected class from all
  document.querySelectorAll('.severity-option').forEach(opt => {
    opt.classList.remove('selected');
  });
  
  // Add selected class to clicked element
  element.classList.add('selected');
}

async function submitBug() {
  const title = document.getElementById('bugTitle').value;
  
  if (!title) {
    alert('Please enter a bug title');
    return;
  }
  
  if (!currentApp) {
    alert('Website data not loaded');
    return;
  }
  
  const bugData = {
    appId: currentApp.id,
    appName: currentApp.name,
    title: title,
    severity: selectedSeverity,
    description: document.getElementById('bugDescription').value,
    steps: document.getElementById('bugSteps').value,
    device: document.getElementById('deviceInfo').value,
    tester: 'Anonymous'
  };
  
  try {
    const submitBtn = event.target;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    const response = await fetch('/api/bugs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bugData)
    });
    
    if (response.ok) {
      alert('✅ Bug submitted successfully!');
      
      // Clear form
      document.getElementById('bugTitle').value = '';
      document.getElementById('bugDescription').value = '';
      document.getElementById('bugSteps').value = '';
      
      // Remove selected severity
      document.querySelectorAll('.severity-option').forEach(opt => {
        opt.classList.remove('selected');
      });
      selectedSeverity = 'low';
      
      // Reload bugs list
      await loadBugsForApp();
      
    } else {
      alert('❌ Failed to submit bug');
    }
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error submitting bug');
  } finally {
    const submitBtn = event.target;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Bug Report';
  }
}

async function loadBugsForApp() {
  if (!appId) return;
  
  try {
    const response = await fetch(`/api/bugs/${appId}`);
    const bugs = await response.json();
    
    const bugsList = document.getElementById('bugsList');
    
    if (!bugs || bugs.length === 0) {
      bugsList.innerHTML = `
                <h4>Your Submitted Bugs</h4>
                <div style="text-align: center; color: #999; padding: 20px;">
                    No bugs submitted yet
                </div>
            `;
      return;
    }
    
    let html = '<h4>Your Submitted Bugs</h4>';
    
    bugs.forEach(bug => {
      const severity = (bug.severity || '').toLowerCase();
      const severityClass = severity.includes('high') ? 'high' :
        (severity.includes('medium') ? 'medium' : 'low');
      
      const date = bug.created_at ? new Date(bug.created_at).toLocaleString() : 'Unknown';
      
      html += `
                <div class="bug-item ${severityClass}">
                    <div class="bug-item-header">
                        <span class="bug-title">${bug.title || 'Untitled'}</span>
                        <span class="bug-status ${bug.status || 'pending'}">${bug.status || 'pending'}</span>
                    </div>
                    <div style="font-size: 12px; color: #666;">
                        ${bug.description ? bug.description.substring(0, 60) + '...' : 'No description'}
                    </div>
                    <div class="bug-meta">
                        <span>${bug.severity || 'Low'}</span>
                        <span>${date}</span>
                    </div>
                </div>
            `;
    });
    
    bugsList.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading bugs:', error);
  }
}

// Make functions global
window.refreshPreview = refreshPreview;
window.toggleDevice = toggleDevice;
window.openInNewTab = openInNewTab;
window.selectSeverity = selectSeverity;
window.submitBug = submitBug;