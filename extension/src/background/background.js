// src/background/background.js

// Restore state from storage to handle Service Worker wakeups
let isRecording = false;
let recordingTabId = null;

// Initialize state from storage
chrome.storage.local.get(['recordingState'], (result) => {
    if (result.recordingState) {
        isRecording = result.recordingState.isRecording;
        recordingTabId = result.recordingState.recordingTabId;
    }
});

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
            return;
        }
        throw err;
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "TOGGLE_CAPTURE") {
        handleToggleCapture(request, sendResponse);
        return true;
    }
    if (request.action === "GET_STATUS") {
        // Always read fresh from storage for status
        chrome.storage.local.get(['recordingState'], (result) => {
            const state = result.recordingState || { isRecording: false };
            sendResponse({ isRecording: state.isRecording });
        });
        return true;
    }
    if (request.action === "STOP_RECORDING_OFFSCREEN") {
        // Internal cleanup
        resetRecordingState();
    }
    if (request.action === "OFFSCREEN_CLEANUP_DONE") {
        // Offscreen finished saving history — safe to close now
        try { chrome.offscreen.closeDocument(); } catch (e) { }
    }
});

async function setRecordingState(active, tabId) {
    isRecording = active;
    recordingTabId = tabId;
    await chrome.storage.local.set({
        recordingState: { isRecording: active, recordingTabId: tabId }
    });
}

async function handleToggleCapture(request, sendResponse) {
    const { tabId, language, targetLanguage, captureMode } = request;

    // Refresh state from storage first
    const stored = await chrome.storage.local.get(['recordingState']);
    if (stored.recordingState) {
        isRecording = stored.recordingState.isRecording;
    }

    if (isRecording) {
        await stopRecording();
        sendResponse({ status: "Translation Stopped", isRecording: false });
    } else {
        await startRecording(tabId, language, targetLanguage, request.token, captureMode, sendResponse);
    }
}

async function stopRecording() {
    chrome.runtime.sendMessage({ action: "STOP_RECORDING_OFFSCREEN" }).catch(() => { });
    // Don't close offscreen immediately — wait for OFFSCREEN_CLEANUP_DONE signal
    // Fallback: close after 5s if signal never comes (was 15s — too slow for TabCapture release)
    setTimeout(async () => {
        try { await chrome.offscreen.closeDocument(); } catch (e) { }
    }, 5000);

    await setRecordingState(false, null);
    chrome.action.setBadgeText({ text: "" });
}

async function startRecording(tabId, language, targetLanguage, token, captureMode, sendResponse) {
    try {
        // Inject scripts
        await chrome.scripting.insertCSS({
            target: { tabId: tabId },
            files: ["src/content/styles.css"]
        }).catch(() => { });

        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["src/content/content.js"]
        }).catch(() => { });

        await setupOffscreenDocument('src/offscreen/offscreen.html');

        const streamId = await chrome.tabCapture.getMediaStreamId({
            targetTabId: tabId
        });

        chrome.runtime.sendMessage({
            action: "START_RECORDING_OFFSCREEN",
            streamId: streamId,
            language: language,
            targetLanguage: targetLanguage,
            token: token,
            captureMode: captureMode || 'video'
        });

        await setRecordingState(true, tabId);
        chrome.action.setBadgeText({ text: "ON" });
        chrome.action.setBadgeBackgroundColor({ color: "#fa5252" });

        sendResponse({ status: "Translation Started", isRecording: true });

    } catch (err) {
        console.error("Error starting capture:", err);

        // AUTO-RECOVERY: If tab is already captured, force a reset and auto-retry.
        if (err.message.includes("Cannot capture a tab with an active stream")) {
            console.log("Stream stuck. Force-resetting and retrying...");

            // Step 1: Tell offscreen to stop its streams first
            chrome.runtime.sendMessage({ action: "STOP_RECORDING_OFFSCREEN" }).catch(() => { });
            await new Promise(r => setTimeout(r, 500));

            // Step 2: Force close offscreen to release TabCapture
            try { await chrome.offscreen.closeDocument(); } catch (e) { }
            await setRecordingState(false, null);
            chrome.action.setBadgeText({ text: "" });

            // Step 3: Wait longer for Chrome to fully release the stream
            await new Promise(r => setTimeout(r, 3000));

            // Step 4: Auto-retry once
            try {
                await setupOffscreenDocument('src/offscreen/offscreen.html');
                const retryStreamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
                chrome.runtime.sendMessage({
                    action: "START_RECORDING_OFFSCREEN",
                    streamId: retryStreamId,
                    language: language,
                    targetLanguage: targetLanguage,
                    token: token,
                    captureMode: captureMode || 'video'
                });
                await setRecordingState(true, tabId);
                chrome.action.setBadgeText({ text: "ON" });
                chrome.action.setBadgeBackgroundColor({ color: "#fa5252" });
                sendResponse({ status: "Translation Started (Recovered)", isRecording: true });
            } catch (retryErr) {
                console.error("Auto-retry also failed:", retryErr);
                sendResponse({ status: "Error: Please reload the page and try again.", isRecording: false });
            }
        } else {
            sendResponse({ status: "Error: " + err.message, isRecording: false });
        }
    }
}

// Listen for messages from Offscreen
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "TRANSCRIPT_RECEIVED") {
        const payload = {
            action: "SHOW_SUBTITLE",
            text: message.text,
            chunkId: message.chunkId,   // Forward unique ID
            isFinal: message.isFinal    // Forward status
        };

        // Need to know WHO to send to. Read from memory (restored) or storage.
        if (recordingTabId) {
            sendToContentScript(recordingTabId, payload);
        } else {
            // Fallback to storage if memory was wiped
            chrome.storage.local.get(['recordingState'], (res) => {
                if (res.recordingState && res.recordingState.recordingTabId) {
                    sendToContentScript(res.recordingState.recordingTabId, payload);
                }
            });
        }
    }
    else if (message.action === "AUTH_ERROR") {
        stopRecording();
        chrome.action.setBadgeText({ text: "ERR" });
        chrome.action.setBadgeBackgroundColor({ color: "#000000" });

        chrome.notifications.create({
            type: 'basic',
            iconUrl: '../icons/icon128.png',
            title: 'Login Expired',
            message: 'Your session has expired. Please open the extension and log in again (1 hour limit).',
            priority: 2
        });
    }
    else if (message.action === "OUT_OF_CREDITS") {
        stopRecording();
        chrome.action.setBadgeText({ text: "0$" });
        chrome.action.setBadgeBackgroundColor({ color: "#000000" });

        chrome.notifications.create({
            type: 'basic',
            iconUrl: '../icons/icon128.png',
            title: 'Out of Credits',
            message: 'Your transcription balance has run out. Please open the extension to add credits.',
            priority: 2
        });
    }
    else if (message.action === "STREAM_DIED") {
        // Auto-reconnect: stream died (tab switch, PiP, Chrome reclaimed)
        console.log("🔄 Stream died — auto-reconnecting...");

        (async () => {
            const stored = await chrome.storage.local.get(['recordingState', 'captureMode']);
            const tabId = stored.recordingState?.recordingTabId;
            const mode = stored.captureMode || 'video';

            if (!tabId) {
                console.error("No tabId saved — cannot reconnect");
                return;
            }

            // Close old offscreen
            try { await chrome.offscreen.closeDocument(); } catch (e) { }

            // Wait for Chrome to release TabCapture
            await new Promise(r => setTimeout(r, 3000));

            // Get saved language settings
            const langData = await chrome.storage.local.get(['stored_language', 'stored_target_language']);
            const lang = langData.stored_language || 'en';
            const targetLang = langData.stored_target_language || 'same';

            // Get token
            const tokenData = await chrome.storage.local.get(['supabase_token']);
            const token = tokenData.supabase_token;

            try {
                await setupOffscreenDocument('src/offscreen/offscreen.html');
                const newStreamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
                chrome.runtime.sendMessage({
                    action: "START_RECORDING_OFFSCREEN",
                    streamId: newStreamId,
                    language: lang,
                    targetLanguage: targetLang,
                    token: token,
                    captureMode: mode
                });
                console.log("✅ Auto-reconnect successful!");
            } catch (err) {
                console.error("❌ Auto-reconnect failed:", err);
                await setRecordingState(false, null);
                chrome.action.setBadgeText({ text: "" });
            }
        })();
    }
});

async function sendToContentScript(tabId, message) {
    try {
        await chrome.tabs.sendMessage(tabId, message);
    } catch (err) {
        console.log("Message failed:", err.message);

        // Auto-Fix: If content script is missing (e.g., user didn't reload page), inject it and retry.
        if (err.message.includes("Receiving end does not exist") || err.message.includes("Could not establish connection")) {
            console.log("Re-injecting content script...", tabId);
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ["src/content/content.js"]
                });
                // Retry once
                await new Promise(r => setTimeout(r, 50));
                await chrome.tabs.sendMessage(tabId, message);
                console.log("Retry successful!");
            } catch (retryErr) {
                console.error("Retry failed:", retryErr.message);
            }
        }
    }
}

// Clean up
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === recordingTabId && changeInfo.status === 'loading') {
        stopRecording();
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === recordingTabId) {
        stopRecording();
    }
});

async function resetRecordingState() {
    await stopRecording();
}
