const toggle = document.getElementById('protectionToggle');
const statusSpan = document.getElementById('status');
const countSpan = document.getElementById('count');

// Load current state
chrome.storage.local.get(['protectionEnabled', 'anonymizationMap'], (result) => {
  const isEnabled = result.protectionEnabled !== false; // Default to true
  
  if (isEnabled) {
    toggle.classList.add('enabled');
    statusSpan.textContent = 'Active';
    statusSpan.classList.remove('inactive');
    toggle.setAttribute('aria-pressed', 'true');
  } else {
    toggle.classList.remove('enabled');
    statusSpan.textContent = 'Inactive';
    statusSpan.classList.add('inactive');
    toggle.setAttribute('aria-pressed', 'false');
  }
  
  if (result.anonymizationMap) {
    countSpan.textContent = Object.keys(result.anonymizationMap).length;
  }
});

// Toggle protection
toggle.addEventListener('click', () => {
  chrome.storage.local.get(['protectionEnabled'], (result) => {
    const newState = result.protectionEnabled !== false ? false : true;
    chrome.storage.local.set({ protectionEnabled: newState });
    
    // Update UI
    toggle.classList.toggle('enabled');
    statusSpan.textContent = newState ? 'Active' : 'Inactive';
    statusSpan.classList.toggle('inactive');
    toggle.setAttribute('aria-pressed', newState.toString());
    
    // Notify content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'toggleProtection',
          enabled: newState
        }).catch(() => {
          // Ignore errors for tabs where content script isn't loaded
        });
      });
    });
  });
});