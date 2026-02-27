// This file manages the anonymization mapping
// It stores the relationship between real data and anonymized placeholders

const anonymizationMap = {
  "john.doe@company.com": "USER_EMAIL_001",
  "4532-1111-2222-3333": "CARD_001",
  "function getPassword()": "CODE_BLOCK_001"
};

// Function to add new mappings dynamically
function addToAnonymizationMap(realValue, anonymizedValue) {
  anonymizationMap[realValue] = anonymizedValue;
  
  // Save to browser's local storage so it persists
  chrome.storage.local.set({ anonymizationMap: anonymizationMap });
}

// Function to retrieve the real value from anonymized placeholder
function deanonymize(anonymizedValue) {
  for (const [realValue, mapped] of Object.entries(anonymizationMap)) {
    if (mapped === anonymizedValue) {
      return realValue;
    }
  }
  return null; // Not found
}

// Function to clear all mappings (for privacy)
function clearAnonymizationMap() {
  for (let key in anonymizationMap) {
    delete anonymizationMap[key];
  }
  chrome.storage.local.set({ anonymizationMap: {} });
}

// Export functions for use in other files
// (These will be available when this script is loaded)