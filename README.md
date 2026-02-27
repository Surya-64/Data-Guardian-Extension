# Data Guardian (Individual Submission - AMD Slingshot)

**Author:** VANAMALA SURYA PRAKASH REDDY

Data Guardian is an on-device, zero-latency "Privacy Firewall" browser extension designed to protect sensitive data from being leaked into public LLM tools (ChatGPT, Gemini, Claude, etc.).

By utilizing local, edge-based AI inference within the browser, Data Guardian creates a secure, localized environment where sensitive PII (Personally Identifiable Information) is intercepted, redacted, and contextually tokenized **before** it ever leaves the user's device. It then dynamically de-anonymizes the AI's response in real-time, allowing users to safely collaborate with public AI models without compromising corporate or personal privacy.

## The Problem: "Shadow AI" and Data Leakage

As public LLMs become ubiquitous, professional productivity has increased, but at a severe cost to data privacy. Employees frequently leak proprietary code, financial records, and critical PII into public chatbots, which are then transmitted to external servers for processing and model training, creating dynamic security and compliance nightmares for enterprises.

## The Solution: Local Intelligence, Universal Privacy

Data Guardian implements a **Zero-Trust architecture on the Edge**. Unlike traditional solutions that completely block AI access or use latency-heavy cloud APIs for data scanning, Data Guardian performs deep content inspection and redaction entirely within the user's browser memory (WASM).

### Key Features

* **Hybrid Anonymization Engine:** Utilizes lightning-fast synchronized Regex matching for immediate detection of standard patterns (Emails, Credit Cards, SSNs) combined with asynchronous, localized Deep Learning (NER) for complex entity detection (Names, Locations).
* **Dynamic De-anonymization (Reverse-Swap):** Intercepts the cloud LLM's reply (containing safe placeholders like `[PER_1]`) and visually reverse-translates them back to the real text instantly on the user's screen using an ephemeral in-memory dictionary.
* **File Upload Sentinel:** Automatically detects and quarantines sensitive file attachments and drag-and-drop actions that cannot be securely scanned locally.
* **Universal Browser Support:** Custom DOM manipulation ensures compatibility across complex React/dynamic text editors used by platforms like ChatGPT and Gemini.
* **100% Local Inference:** No user data is sent to Data Guardian servers. All scanning and inference happen within the browser's Service Worker via WebAssembly (WASM).

## Architecture & How it Works

Data Guardian employs a sophisticated multi-layered architecture optimized for edge execution.

1.  **Presentation Layer (Content Script):** Intercepts all `input`, `paste`, and `drop` events on supported AI websites. PII is redacted contextually (`[PER_1]`, `[EMAIL_1]`) and stored in an ephemeral, local dictionary. Manual typing includes a debouncer (delayed scan) to prevent UI lag.
2.  **Inference Layer (Service Worker):** A lightweight background process running the HuggingFace `Xenova/bert-base-NER` quantized NLP model. It utilizes the `Transformers.js` library and WebAssembly (WASM) to perform hardware-independent token classification directly on the edge.
3.  **De-anonymization Layer:** An active `MutationObserver` watches the page for AI replies and utilizes the local memory dictionary to visually unmask safe placeholders for the end-user.

## Hackathon Assets

* **GitHub Repository:** (https://github.com/Surya-64/Data-Guardian-Extension.git)
* **YouTube Demo Video:** [[INSERT LINK HERE]]

## Usage of AMD Products/Solutions

### Offloading Privacy Enforcement to the Edge with Ryzen™ AI

This project aligns perfectly with AMD’s vision of pervasive, ubiquitous Edge AI. Data Guardian leverages **WebAssembly (WASM)** and standardized **ONNX Runtime** models within the browser’s execution environment. This architectural choice is specifically designed to allow seamless offloading of the critical inference tasks (Token Classification/NER) from the main laptop CPU directly to **AMD Ryzen™ AI NPUs** via hardware acceleration paths.

By migrating the AI-based privacy firewall tasks to the dedicated NPU, enterprise users can achieve:
1.  Zero performance impact on typing or page interactivity (0% main CPU utilization for background security checks).
2.  Instantaneous, hardware-accelerated text anonymization.
3.  Massive efficiency gains, crucial for maintaining battery life on corporate laptops.

## Future Roadmap

The limitations encountered during development have formed a robust strategic roadmap for Phase 2/3:

* **Phase 2: Local OCR for Images:** Implementing localized Optical Character Recognition to redact PII from attached screenshots before transmission.
* **Phase 3: Combating Regional Model Bias:** Testing exposed that base NER models struggle with regional Indian names (e.g., "Surya") when not grammar-perfectly capitalized. Our roadmap includes fine-tuning a custom, quantized NER model specifically trained on Indian corporate datasets and optimized for AMD NPU edge deployment.

## Installation Instructions (for developers)

**Prerequisites:**
* **Chrome Browser** (or any Chromium-based browser like Edge/Brave).
* **Node.js/npm** (optional, only needed if you want to modify the quantized models).

**Steps:**

1.  Clone this repository to your local machine.
    ```bash
    git clone https://github.com/Surya-64/Data-Guardian-Extension.git
    ```
2.  Download the required `transformers.min.js` file into your project folder. (We are using an essential direct download command here to bypass standard web download quirks during development).
    ```bash
    curl -o transformers.min.js [https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js](https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js)
    ```
3.  Open the Chrome extension management page: Navigate to `chrome://extensions`.
4.  Enable **Developer Mode** by toggling the switch in the top right corner.
5.  Click **Load unpacked** and select the root folder of your project (where `manifest.json` is located).
6.  Navigate to [https://chatgpt.com](https://chatgpt.com).
7.  **Crucial:** Perform a **Hard Refresh (Ctrl+F5)** on the ChatGPT page to ensure the background script loads and initializes the AI model. *Wait a few seconds for the background console to say `✅ AI Engine Ready on the Edge!`.*

### Testing the Privacy Firewall

**Manual Typing Test:**
1.  Type: `I am Vanamala Surya Prakash Reddy.` (Use proper capitalization for BERT model parsing).
2.  Wait 1.5 seconds after typing (Debounce delay). Watch it anonymize to `[PER_1] [PER_2] [PER_3]`.

**Paste Test (Deep AI Scan):**
1.  Copy this sentence: `Michael Scott works at Dunder Mifflin. His email is michael@dundermifflin.com and his phone is 555-123-4567.`
2.  Paste it into the chat box.
3.  Observe that **instantly**, both the dynamic deep AI scan (Names) and fast Regex scan (Email/Phone) have secured the data: `[PER_1] [PER_2] works at [LOC_1] [LOC_2]. His email is [EMAIL_1] and his phone is [PHONE_1].`

**De-anonymization (Reverse-Swap) Test:**
1.  Hit send on the anonymized text above.
2.  Watch ChatGPT reply using your `[PER_1]` tokens. The response visually displays the real names/PII to you dynamically, while ChatGPT only ever saw the placeholders.

---
