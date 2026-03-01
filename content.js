/**
 * DATA GUARDIAN: Crash-Proof Sync Engine (DEMO VERSION)
 * Includes all console.logs for Hackathon Presentation!
 */

console.log("🛡️ Data Guardian: Crash-Proof Engine LOADED");

const SENSITIVE_PATTERNS = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
};

let isProtectionEnabled = true;
let localCounter = 1; 
let memoryMap = {}; 
let isInternalChange = false; // The Lock
let typingTimer;
const AI_DELAY_MS = 1500;

chrome.storage.local.get(['protectionEnabled', 'anonymizationMap'], (result) => {
    isProtectionEnabled = result.protectionEnabled !== false;
    memoryMap = result.anonymizationMap || {};
});

function saveToMap(realText, placeholder) {
    memoryMap[placeholder] = realText;
    try {
        if (chrome.runtime?.id) chrome.storage.local.set({ anonymizationMap: memoryMap });
    } catch (e) {}
}

// 1. FAST REGEX
function anonymizeTextSync(text) {
    let anonymized = text;
    for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
        anonymized = anonymized.replace(pattern, (match) => {
            const placeholder = `[${type.toUpperCase()}_${localCounter++}]`;
            saveToMap(match, placeholder);
            console.log(`⚡ Regex Match: Swapped '${match}' for ${placeholder}`);
            return placeholder;
        });
    }
    return anonymized;
}

// 2. AI ENGINE
async function anonymizeTextAsync(text) {
    let anonymized = anonymizeTextSync(text);
    try {
        if (!chrome.runtime?.id) return anonymized;
        
        console.log("🧠 Sending to Edge AI for Name/Location scan...");
        const response = await chrome.runtime.sendMessage({ action: 'ai_scan', text: anonymized });
        
        if (response && response.entities) {
            let merged = [];
            let curWord = "";
            let curTag = "";

            response.entities.forEach(entity => {
                const label = entity.entity_group || entity.entity || "";
                if (entity.word.startsWith('##')) curWord += entity.word.replace('##', '');
                else {
                    if (curWord) merged.push({ word: curWord, tag: curTag });
                    curWord = entity.word;
                    curTag = label;
                }
            });
            if (curWord) merged.push({ word: curWord, tag: curTag });

            merged.forEach(entity => {
                const label = entity.tag || entity.label || "";
                if (label.includes('PER') || label.includes('LOC')) {
                    const clean = entity.word.trim();
                    if (clean.length > 2) { 
                        const placeholder = `[${label.includes('PER') ? 'PER' : 'LOC'}_${localCounter++}]`;
                        saveToMap(clean, placeholder);
                        const regex = new RegExp(clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                        anonymized = anonymized.replace(regex, placeholder);
                        console.log(`✅ AI successfully stitched and swapped: ${clean} -> ${placeholder}`);
                    }
                }
            });
        }
    } catch (e) { console.warn("AI Offline..."); }
    return anonymized;
}

// 3. CRASH-PROOF REACT SYNC
function insertTextUniversally(target, text) {
    if (isInternalChange) return;
    
    try {
        isInternalChange = true; 

        let el = target.nodeType === Node.TEXT_NODE ? target.parentNode : target;
        let editor = el.closest ? (el.closest('#prompt-textarea') || el.closest('[contenteditable="true"]')) : el;
        
        if (!editor) return;

        let currentText = editor.innerText || editor.textContent || editor.value || "";
        if (currentText.trim() === text.trim()) return;

        editor.focus();

        if (editor.isContentEditable || editor.contentEditable === 'true') {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(editor);
            selection.removeAllRanges();
            selection.addRange(range);
            document.execCommand('insertText', false, text);
        } else {
            editor.value = text;
        }

        editor.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

    } catch (error) {
        console.error("Data Guardian Sync Error:", error);
    } finally {
        setTimeout(() => { isInternalChange = false; }, 100);
    }
}

// 4. EVENT HANDLERS
window.addEventListener('paste', async (e) => {
    if (!isProtectionEnabled || isInternalChange) return;
    const pastedText = e.clipboardData?.getData('text');
    if (!pastedText) return;

    e.preventDefault(); 
    e.stopImmediatePropagation(); 
    
    try {
        const fastAnon = anonymizeTextSync(pastedText);
        insertTextUniversally(e.target, fastAnon);

        const deepAnon = await anonymizeTextAsync(pastedText);
        if (deepAnon !== fastAnon) insertTextUniversally(e.target, deepAnon);
    } catch (err) {}
}, true);

window.addEventListener('input', (e) => {
    if (!isProtectionEnabled || isInternalChange) return;

    try {
        let el = e.target.nodeType === Node.TEXT_NODE ? e.target.parentNode : e.target;
        let editor = el.closest ? (el.closest('#prompt-textarea') || el.closest('[contenteditable="true"]')) : el;
        if (!editor) return;

        let text = editor.isContentEditable ? (editor.innerText || editor.textContent) : editor.value;
        if (!text) return;

        let fastAnon = anonymizeTextSync(text);
        if (fastAnon !== text) {
            insertTextUniversally(editor, fastAnon);
            text = fastAnon; 
        }

        clearTimeout(typingTimer);
        typingTimer = setTimeout(async () => {
            if (isInternalChange) return;
            
            console.log("⏱️ User paused typing. Triggering Deep AI Scan...");
            let currentText = editor.isContentEditable ? (editor.innerText || editor.textContent) : editor.value;
            let aiAnon = await anonymizeTextAsync(currentText);
            
            if (aiAnon !== currentText) insertTextUniversally(editor, aiAnon);
        }, AI_DELAY_MS);
    } catch (err) {}
}, true);

// 5. OBSERVER
const observer = new MutationObserver((mutations) => {
    if (!isProtectionEnabled || Object.keys(memoryMap).length === 0) return;
    mutations.forEach((mutation) => {
        const targetNode = mutation.type === 'characterData' ? mutation.target.parentNode : mutation.target;
        if (targetNode && !targetNode.isContentEditable && targetNode.tagName !== 'TEXTAREA') {
            const walker = document.createTreeWalker(targetNode, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while (node = walker.nextNode()) {
                let val = node.nodeValue;
                let changed = false;
                for (const [placeholder, real] of Object.entries(memoryMap)) {
                    if (val.includes(placeholder)) {
                        val = val.replaceAll(placeholder, real);
                        changed = true;
                    }
                }
                if (changed) node.nodeValue = val;
            }
        }
    });
});
if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });

// ==========================================
// 6. ENTERPRISE FILE BLOCKER (Drag & Drop + Click)
// ==========================================

// A. Block Drag and Drop Uploads
window.addEventListener('drop', (e) => {
    if (!isProtectionEnabled) return;
    
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        alert("🛡️ Data Guardian: Drag-and-drop file uploads are blocked to prevent data leakage.");
    }
}, true);

// B. Block the Paperclip / Attachment Button
window.addEventListener('click', (e) => {
    if (!isProtectionEnabled) return;
    
    // Target ChatGPT's specific upload button or any hidden file inputs
    const uploadBtn = e.target.closest('button[aria-label="Attach files"]') || 
                      e.target.closest('input[type="file"]');
                      
    if (uploadBtn) {
        e.preventDefault();
        e.stopImmediatePropagation();
        alert("🛡️ Data Guardian: File attachments are disabled by your local security policy.");
    }
}, true);
