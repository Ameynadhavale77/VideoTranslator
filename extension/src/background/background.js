// src/background/background.js

let isRecording = false;
let recordingTabId = null;

// Ensure offscreen document exists
async function setupOffscreenDocument(path) {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [path]
    });

    if (existingContexts.length > 0) {
        return;
    }

    // Create offscreen document
    try {
        await chrome.offscreen.createDocument({
            url: path,
            reasons: ['USER_MEDIA'],
            justification: 'Recording tab audio for translation'
        });
    } catch (err) {
        if (err.message.includes('Only a single offscreen document may be created')) {
            // Ignore this error, it just means we are good to go
            return;
        }
        throw err;
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "TOGGLE_CAPTURE") {
        handleToggleCapture(request, sendResponse);
        return true; // Keep message channel open for async response
    }
    if (request.action === "GET_STATUS") {
        sendResponse({ isRecording: isRecording });
    }
});

async function handleToggleCapture(request, sendResponse) {
    const { tabId, language, targetLanguage } = request;

    if (isRecording) {
        // ... (stop logic) ...
        // ... (stop logic remains same) ...
        // STOP RECORDING
        chrome.runtime.sendMessage({ action: "STOP_RECORDING_OFFSCREEN" });

        // Force close the offscreen document to ensure tab capture stops completely
        chrome.offscreen.closeDocument();

        isRecording = false;
        recordingTabId = null;
        chrome.action.setBadgeText({ text: "" });
        sendResponse({ status: "Translation Stopped", isRecording: false });
    } else {
        // START RECORDING
        try {
            // FORCE PRE-INJECTION of Content Script

            // FORCE PRE-INJECTION of Content Script
            // This ensures the receiver exists before we try to talk to it.
            await chrome.scripting.insertCSS({
                target: { tabId: tabId },
                files: ["src/content/styles.css"]
            }).catch(() => { }); // Ignore error if already injected

            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ["src/content/content.js"]
            }).catch(() => { }); // Ignore error if already injected

            await setupOffscreenDocument('src/offscreen/offscreen.html');

            // Get Stream ID for the specific tab
            const streamId = await chrome.tabCapture.getMediaStreamId({
                targetTabId: tabId
            });

            // Send Stream ID and API Key to Offscreen document
            chrome.runtime.sendMessage({
                action: "START_RECORDING_OFFSCREEN",
                streamId: streamId,
                language: language,
                targetLanguage: targetLanguage,
                token: request.token // Pass the Auth Token
            });

            isRecording = true;
            recordingTabId = tabId;
            chrome.action.setBadgeText({ text: "ON" });
            chrome.action.setBadgeBackgroundColor({ color: "#fa5252" });

            sendResponse({ status: "Translation Started", isRecording: true });

        } catch (err) {
            console.error("Error starting capture:", err);
            // Handle "active stream" error
            if (err.message.includes("Cannot capture a tab with an active stream")) {
                sendResponse({ status: "Error: Tab already capturing. Please refresh the page.", isRecording: false });
            } else {
                sendResponse({ status: "Error: " + err.message, isRecording: false });
            }
        }
    }
}

// Listen for messages from Offscreen (Transcript Relay)
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "TRANSCRIPT_RECEIVED") {
        if (recordingTabId) {
            sendToContentScript(recordingTabId, {
                action: "SHOW_SUBTITLE",
                text: message.text
            });
        }
    }
});

// Robust Message Sender with Auto-Injection
async function sendToContentScript(tabId, message) {
    try {
        await chrome.tabs.sendMessage(tabId, message);
    } catch (err) {
        console.log("Message failed, attempting re-injection:", err.message);

        // If message failed, likely content script is missing. Inject it.
        try {
            await chrome.scripting.insertCSS({
                target: { tabId: tabId },
                files: ["src/content/styles.css"]
            });
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ["src/content/content.js"]
            });

            // Wait 100ms for script to init
            await new Promise(r => setTimeout(r, 100));

            // Retry sending ONCE
            await chrome.tabs.sendMessage(tabId, message);
            console.log("Re-injection/Retry successful.");
        } catch (retryErr) {
            console.error("Critical: Could not send to content script even after injection:", retryErr);
            // Don't kill recording here, maybe it's just one frame.
        }
    }
}

// Clean up if the recorded tab is closed or refreshed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === recordingTabId && changeInfo.status === 'loading') {
        console.log("Recorded tab refreshed or negotiated, resetting state.");
        resetRecordingState();
    }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (tabId === recordingTabId) {
        console.log("Recorded tab closed, resetting state.");
        resetRecordingState();
    }
});

function resetRecordingState() {
    isRecording = false;
    recordingTabId = null;
    chrome.action.setBadgeText({ text: "" });
    // Try to close offscreen just in case
    chrome.offscreen.closeDocument().catch(err => console.log("Offscreen close error:", err));
}
