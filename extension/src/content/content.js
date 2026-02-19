// src/content/content.js

console.log("Video Translator: Content script loaded.");

// Define global variables only once
if (typeof subtitleContainer === 'undefined') {
    var subtitleContainer = null;
    var fadeTimeout = null;
    var lastShownText = ""; // Dedup tracker
    var readyCleared = false; // Track if Ready message was cleared
}

// ZOMBIE CLEANUP: Remove old container if it exists (fixes "Context Invalidated" on reload)
{
    const oldContainer = document.getElementById('video-translator-subs');
    if (oldContainer) {
        oldContainer.remove();
        subtitleContainer = null;
    }
}

// Show status immediately on load to verify injection
createSubtitleContainer();

if (subtitleContainer) {
    subtitleContainer.textContent = "Live Video Translator: Ready";
    setTimeout(() => {
        if (subtitleContainer && subtitleContainer.textContent === "Live Video Translator: Ready") {
            subtitleContainer.textContent = "";
            subtitleContainer.style.opacity = '0';
        }
    }, 3000);
}

function createSubtitleContainer() {
    if (subtitleContainer) return;

    subtitleContainer = document.createElement('div');
    subtitleContainer.id = 'video-translator-subs';

    // Default Styles
    subtitleContainer.style.position = 'fixed';
    subtitleContainer.style.padding = '10px 20px';
    subtitleContainer.style.borderRadius = '5px';
    subtitleContainer.style.fontSize = '20px';
    subtitleContainer.style.fontFamily = 'Arial, sans-serif';
    subtitleContainer.style.zIndex = '2147483647'; // Max Z-Index
    subtitleContainer.style.textAlign = 'center';
    subtitleContainer.style.maxWidth = '80%';
    subtitleContainer.style.transition = 'all 0.3s ease';
    subtitleContainer.style.textShadow = '2px 2px 2px #000';
    subtitleContainer.style.cursor = 'move'; // Show it's draggable
    subtitleContainer.style.userSelect = 'none'; // Prevent text selection while dragging

    // --- STABLE MODE (Anti-Jitter) ---
    subtitleContainer.style.minHeight = '100px'; // Prevent vertical jumping
    subtitleContainer.style.display = 'flex';
    subtitleContainer.style.flexDirection = 'column'; // Stack multiple lines
    subtitleContainer.style.justifyContent = 'flex-end'; // Anchor to bottom (Newest at bottom pushes up)
    subtitleContainer.style.alignItems = 'center'; // Center text horizontally

    // Load Saved Settings (Position & Colors)
    chrome.storage.local.get(['sub_position', 'sub_color', 'sub_bg_color', 'sub_bg_opacity'], (data) => {
        // Position
        if (data.sub_position) {
            subtitleContainer.style.top = data.sub_position.top;
            subtitleContainer.style.left = data.sub_position.left;
            subtitleContainer.style.bottom = 'auto';
            subtitleContainer.style.transform = 'none';
        } else {
            // Default Bottom Center
            subtitleContainer.style.bottom = '100px';
            subtitleContainer.style.left = '50%';
            subtitleContainer.style.transform = 'translateX(-50%)';
            subtitleContainer.style.top = 'auto';
        }

        // Colors & Opacity
        const textColor = data.sub_color || '#FFFFFF';
        const bgColor = data.sub_bg_color || '#000000';
        const opacity = data.sub_bg_opacity !== undefined ? data.sub_bg_opacity : 70;

        subtitleContainer.style.color = textColor;
        updateBackgroundColor(bgColor, opacity);
    });

    document.body.appendChild(subtitleContainer);
    makeDraggable(subtitleContainer);
}

// Helper: Convert Hex + Opacity to RGBA
function updateBackgroundColor(hex, opacityPercent) {
    if (!subtitleContainer) return;

    // Remove #
    hex = hex.replace('#', '');

    // Parse RGB
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // Convert Opacity to 0-1 range
    let a = opacityPercent / 100;

    subtitleContainer.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${a})`;
}

// --- Drag & Drop Logic ---
function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    element.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // Get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // Call a function whenever the cursor moves:
        document.onmousemove = elementDrag;

        // Temporarily disable transition during drag for smoothness
        element.style.transition = 'opacity 0.3s ease';
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // Calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        // Set the element's new position:
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";

        // Clear transform/bottom to allow free movement if it was centered previously
        element.style.transform = 'none';
        element.style.bottom = 'auto';
    }

    function closeDragElement() {
        // Stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;

        // Re-enable transitions
        element.style.transition = 'opacity 0.3s ease, color 0.3s ease, background-color 0.3s ease';

        // Save new position
        const newPos = {
            top: element.style.top,
            left: element.style.left
        };
        chrome.storage.local.set({ 'sub_position': newPos });
    }
}

// Prevent Multiple Listeners
// Listen for messages from Background Script (Relay)
chrome.runtime.onMessage.addListener((message) => {
    if (!subtitleContainer) createSubtitleContainer();

    if (message.action === "SHOW_SUBTITLE") {
        createSubtitleContainer();

        // Clear "Ready" text on first real subtitle
        if (!readyCleared) {
            readyCleared = true;
            // Remove any bare text nodes (the "Ready" message)
            Array.from(subtitleContainer.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) node.remove();
            });
        }

        const { chunkId, text, isFinal } = message;

        // Dedup: skip if exact same text as last shown chunk
        if (text === lastShownText && !document.getElementById(`chunk-${chunkId}`)) {
            return;
        }
        lastShownText = text;

        // 1. Try to find existing chunk
        let chunkElement = document.getElementById(`chunk-${chunkId}`);

        if (chunkElement) {
            // Update existing chunk (Interim -> Final)
            chunkElement.textContent = text;
        } else {
            // Create new chunk
            chunkElement = document.createElement('div');
            chunkElement.id = `chunk-${chunkId}`;
            chunkElement.textContent = text;
            chunkElement.style.marginBottom = '5px';
            subtitleContainer.appendChild(chunkElement);
        }

        // 2. Style based on status (UNIFIED STYLE - No Hybrid)
        // Always White, Always Bold, Always Clear
        chunkElement.style.color = '#FFFFFF';
        chunkElement.style.fontWeight = 'bold';
        chunkElement.style.fontStyle = 'normal';
        chunkElement.style.opacity = '1';
        chunkElement.style.textShadow = '2px 2px 2px #000000'; // Improve readability

        subtitleContainer.style.opacity = '1';

        // Limit visible lines (Keep recent 3 for fast speech)
        // Strictly select chunk elements to avoid removing other potential children
        let chunks = subtitleContainer.querySelectorAll('div[id^="chunk-"]');
        while (chunks.length > 3) {
            chunks[0].remove();
            chunks = subtitleContainer.querySelectorAll('div[id^="chunk-"]');
        }

        if (fadeTimeout) clearTimeout(fadeTimeout);
        fadeTimeout = setTimeout(() => {
            subtitleContainer.style.opacity = '0';
        }, 10000);
    }

    // --- Customization Handling ---
    else if (message.action === "UPDATE_STYLE") {
        // Get current values from storage to merge updates
        chrome.storage.local.get(['sub_color', 'sub_bg_color', 'sub_bg_opacity'], (data) => {
            const currentColor = message.color || data.sub_color || '#FFFFFF';
            const currentBgColor = message.bgColor || data.sub_bg_color || '#000000';
            const currentOpacity = message.bgOpacity !== undefined ? message.bgOpacity : (data.sub_bg_opacity !== undefined ? data.sub_bg_opacity : 70);

            if (message.color) subtitleContainer.style.color = message.color;

            // Always update background to ensure opacity mixes correctly
            updateBackgroundColor(currentBgColor, currentOpacity);
        });
    }
    else if (message.action === "RESET_POSITION") {
        subtitleContainer.style.top = 'auto';
        subtitleContainer.style.bottom = '100px';
        subtitleContainer.style.left = '50%';
        subtitleContainer.style.transform = 'translateX(-50%)';
        chrome.storage.local.remove('sub_position');
    }
});
