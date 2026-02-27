console.log("🛡️ Data Guardian Content Script LOADED");

const SENSITIVE_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
};

let isProtectionEnabled = true;
let localCounter = 1; 
let memoryMap = {}; // Keeps a fast local copy for reverse-swapping

// Load existing map on startup
chrome.storage.local.get(['protectionEnabled', 'anonymizationMap'], (result) => {
  isProtectionEnabled = result.protectionEnabled !== false;
  memoryMap = result.anonymizationMap || {};
});

// Helper: Save placeholder to both local memory and Chrome storage (Ghost-Script Safe)
function saveToMap(realText, placeholder) {
  memoryMap[placeholder] = realText;
  
  try {
    if (chrome.runtime && chrome.runtime.id) {
      chrome.storage.local.set({ anonymizationMap: memoryMap });
    }
  } catch (error) {
    console.warn("⚠️ Extension was updated! Please refresh this tab to keep saving data.");
  }
}

// 1. SYNC REGEX SCANNER (For fast typing)
function anonymizeTextSync(text) {
  let anonymized = text;
  for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    anonymized = anonymized.replace(pattern, (match) => {
      const placeholder = `[${type.toUpperCase()}_${localCounter++}]`;
      saveToMap(match, placeholder);
      return placeholder;
    });
  }
  return anonymized;
}

// 2. ASYNC AI + REGEX SCANNER (With Manual Sub-Word Stitching)
async function anonymizeTextAsync(text) {
  let anonymized = anonymizeTextSync(text);
  
  try {
    if (chrome.runtime?.id) {
      console.log("🧠 Sending to AI for Name/Location scan...");
      const response = await chrome.runtime.sendMessage({ action: 'ai_scan', text: anonymized });
      
      if (response && response.entities) {
        
        // STEP 1: Manually stitch the AI's shattered tokens back into full words!
        let mergedEntities = [];
        let currentWord = "";
        let currentTag = "";

        response.entities.forEach(entity => {
            const label = entity.entity_group || entity.entity || "";
            let wordPart = entity.word;

            if (wordPart.startsWith('##')) {
                // If it's a fragment, attach it to the current word
                currentWord += wordPart.replace('##', ''); 
            } else {
                // If it's a new word, save the old one and start fresh
                if (currentWord.length > 0) {
                    mergedEntities.push({ word: currentWord, label: currentTag });
                }
                currentWord = wordPart; 
                currentTag = label;
            }
        });
        // Catch the very last word in the loop
        if (currentWord.length > 0) {
            mergedEntities.push({ word: currentWord, label: currentTag });
        }

        // STEP 2: Replace the fully stitched words
        mergedEntities.forEach(entity => {
          if (entity.label.includes('PER') || entity.label.includes('LOC')) {
             const cleanWord = entity.word.trim();
             const baseTag = entity.label.includes('PER') ? 'PER' : 'LOC';
             
             if (cleanWord.length > 2) { 
               const placeholder = `[${baseTag}_${localCounter++}]`;
               saveToMap(cleanWord, placeholder);
               
               const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
               const regex = new RegExp(escapeRegExp(cleanWord), 'gi');
               
               anonymized = anonymized.replace(regex, placeholder);
               console.log(`✅ Successfully stitched and swapped: ${cleanWord} -> ${placeholder}`);
             }
          }
        });
      }
    }
  } catch (e) {
    console.warn("⚠️ AI scan skipped:", e);
  }
  
  return anonymized;
}

// ===== UNIVERSAL TEXT INSERTION (React Bypass) =====
function insertTextUniversally(target, text) {
  if (target.isContentEditable || target.contentEditable === 'true') {
    document.execCommand("insertText", false, text);
  } else if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const originalText = target.value;
    const newText = originalText.substring(0, start) + text + originalText.substring(end);

    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    if (target.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
      nativeTextAreaValueSetter.call(target, newText);
    } else {
      target.value = newText;
    }
    target.selectionStart = target.selectionEnd = start + text.length;
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// ===== 1. PASTE INTERCEPTION (Now uses AI Engine!) =====
document.addEventListener('paste', async (e) => {
  if (!isProtectionEnabled) return;
  
  const pastedText = e.clipboardData.getData('text');
  if (!pastedText) return;

  // Instantly block the paste so the real data never hits the page
  e.preventDefault(); 
  e.stopPropagation();
  e.stopImmediatePropagation();
  
  // Send to AI for deep scanning
  const anonymized = await anonymizeTextAsync(pastedText);
  
  // Insert the safe text
  insertTextUniversally(e.target, anonymized); 
  
  if (anonymized !== pastedText) {
    try {
      chrome.runtime.sendMessage({
        action: 'showNotification', message: `✅ AI Secured pasted data`
      }).catch(() => {});
    } catch(err) {}
  }
}, true);

// ===== 2. MANUAL TYPING (Fast Regex + Delayed AI) =====
let isProcessingInput = false;
let typingTimer; // This is our new delay timer!
const AI_DELAY_MS = 1500; // Wait 1.5 seconds after they stop typing

document.addEventListener('input', (e) => {
  if (!isProtectionEnabled || isProcessingInput) return;

  const target = e.target;
  const editor = target.closest('[contenteditable="true"]') || target;
  let textToAnalyze = editor?.isContentEditable ? (editor.innerText || editor.textContent) : editor.value;

  if (!textToAnalyze) return;

  // 1. INSTANT REGEX SCAN (Keeps keyboard fast for emails/cards)
  let anonymized = anonymizeTextSync(textToAnalyze);
  
  // Clean up auto-links
  anonymized = anonymized.replace(/\[(.*?)\]\(mailto:.*?\)/g, '$1');
  anonymized = anonymized.replace(/\[(.*?)\]\(https?:\/\/.*?\)/g, '$1');

  if (anonymized !== textToAnalyze) {
    isProcessingInput = true; 
    
    if (editor.isContentEditable) {
      editor.innerText = anonymized;
      // Note: Re-placing text dynamically pushes the cursor to the end
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false); 
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      insertTextUniversally(editor, anonymized);
    }

    setTimeout(() => { isProcessingInput = false; }, 50);
  }

  // 2. THE NEW AI DEBOUNCE TIMER
  clearTimeout(typingTimer); // Cancel the old timer if they keep typing
  
  typingTimer = setTimeout(async () => {
    // They stopped typing for 1.5 seconds! Let's run the deep AI scan.
    let currentText = editor?.isContentEditable ? (editor.innerText || editor.textContent) : editor.value;
    if (!currentText) return;

    console.log("⏱️ User paused. Running background AI scan...");
    
    // We reuse our awesome async AI function from the Paste section!
    let aiAnonymized = await anonymizeTextAsync(currentText);

    if (aiAnonymized !== currentText) {
      isProcessingInput = true;
      if (editor.isContentEditable) {
        editor.innerText = aiAnonymized;
        // Reset cursor to end
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        editor.value = aiAnonymized;
      }
      setTimeout(() => { isProcessingInput = false; }, 50);
    }
  }, AI_DELAY_MS);

}, true);

// ===== 3. REVERSE TRANSLATION (Dynamic De-anonymization) =====
// This watches the screen for AI replies and swaps [EMAIL_1] back to the real text
const observer = new MutationObserver((mutations) => {
  if (!isProtectionEnabled || Object.keys(memoryMap).length === 0) return;

  mutations.forEach((mutation) => {
    if (mutation.type === 'characterData' || mutation.type === 'childList') {
      const targetNode = mutation.type === 'characterData' ? mutation.target.parentNode : mutation.target;
      
      // Don't translate the user's own input box, only the AI's chat bubbles!
      if (targetNode && !targetNode.isContentEditable && targetNode.tagName !== 'TEXTAREA') {
        
        // Walk through the text nodes and translate
        const walker = document.createTreeWalker(targetNode, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
          let text = node.nodeValue;
          let changed = false;
          
          // Check against our memory dictionary
          for (const [placeholder, realValue] of Object.entries(memoryMap)) {
            if (text.includes(placeholder)) {
              text = text.replaceAll(placeholder, realValue);
              changed = true;
            }
          }
          
          if (changed) {
            node.nodeValue = text;
          }
        }
      }
    }
  });
});

// Safely wait for the page body to exist before attaching the translator
function startObserver() {
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    console.log("👀 AI Response Observer safely attached!");
  } else {
    requestAnimationFrame(startObserver);
  }
}
startObserver();

// ===== 4. FILE UPLOAD BLOCKER =====
document.addEventListener('drop', (e) => {
  if (isProtectionEnabled && e.dataTransfer?.files?.length > 0) {
    e.preventDefault(); e.stopPropagation();
    alert("🛡️ Data Guardian Warning:\n\nFile uploads cannot be securely scanned locally. Blocked to prevent data leakage.");
  }
}, true);
document.addEventListener('change', (e) => {
  if (isProtectionEnabled && e.target.tagName === 'INPUT' && e.target.type === 'file' && e.target.files.length > 0) {
    e.target.value = ''; 
    alert("🛡️ Data Guardian Warning:\n\nFile uploads cannot be securely scanned locally. Blocked to prevent data leakage.");
  }
}, true);