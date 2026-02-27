import { pipeline, env } from './transformers.min.js';

// Configure the AI to cache the model in your browser 
env.allowLocalModels = false; 
env.useBrowserCache = true;

// 🛑 THE FIX: Disable WebAssembly multi-threading so Chrome's Service Worker doesn't crash
env.backends.onnx.wasm.numThreads = 1;

let detector = null;

console.log("🔍 Background Service Worker (AI Module) LOADED");

// Initialize the local AI model (The AMD Edge Pitch)
async function loadModel() {
  console.log("⏳ Downloading/Loading AI model (this takes 10-20 seconds on first run)...");
  try {
    detector = await pipeline('token-classification', 'Xenova/bert-base-NER', {
      device: 'wasm' // This is the WebAssembly flag that AMD NPUs can accelerate!
    });
    console.log("✅ AI Engine Ready on the Edge!");
  } catch (e) {
    console.error("❌ Failed to load AI model:", e);
  }
}

// Start loading the model immediately in the background
loadModel();

// Initialize default settings
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    protectionEnabled: true,
    anonymizationMap: {}
  });
  console.log("📊 Default settings initialized");
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // 1. AI SCAN REQUEST (With Aggregation Fix)
  if (request.action === 'ai_scan') {
    if (!detector) {
      console.log("⚠️ Model still loading, skipping AI scan for now.");
      sendResponse({ entities: [] });
      return true;
    }
    
    // 'simple' aggregation stitches "Ha" + "##rs" + "##ha" back into "Harsha"
    detector(request.text, { aggregation_strategy: 'simple' }).then(entities => {
      sendResponse({ entities: entities });
    }).catch(e => {
      console.error("AI Scan error:", e);
      sendResponse({ entities: [] });
    });
    
    return true; // Keep message channel open for async response
  }
  
  // 2. STANDARD NOTIFICATIONS
  if (request.action === 'showNotification') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      title: '🛡️ Data Guardian',
      message: request.message,
      priority: 2
    }).catch(()=>{});
    sendResponse({ success: true });
  }
  
  if (request.action === 'showWarning') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      title: '⚠️ Sensitive Data Blocked',
      message: "Data Guardian blocked a sensitive transfer.",
      priority: 2
    }).catch(()=>{});
    sendResponse({ success: true });
  }
  
  return true;
});

// Keep-alive alarm to prevent the service worker from sleeping
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log("💓 AI Background Worker active");
  }
});