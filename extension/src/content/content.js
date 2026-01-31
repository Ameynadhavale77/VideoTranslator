// src/content/content.js

console.log("Video Translator: Content script loaded.");

// Prevent variable redeclaration if script is injected multiple times
if (typeof subtitleContainer === 'undefined') {
    var subtitleContainer = null;
    var fadeTimeout = null;
}

// Show status immediately on load to verify injection
createSubtitleContainer();
subtitleContainer.textContent = "Video Translator: Ready";
setTimeout(() => {
    if (subtitleContainer.textContent === "Video Translator: Ready") {
        subtitleContainer.textContent = "";
        subtitleContainer.style.opacity = '0';
    }
}, 3000);

function createSubtitleContainer() {
    if (subtitleContainer) return;

    subtitleContainer = document.createElement('div');
    subtitleContainer.id = 'video-translator-subs';

    // Style it to look like Netflix/YouTube subtitles
    subtitleContainer.style.position = 'fixed';
    subtitleContainer.style.bottom = '100px';
    subtitleContainer.style.left = '50%';
    subtitleContainer.style.transform = 'translateX(-50%)';
    subtitleContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    subtitleContainer.style.color = 'white';
    subtitleContainer.style.padding = '10px 20px';
    subtitleContainer.style.borderRadius = '5px';
    subtitleContainer.style.fontSize = '24px';
    subtitleContainer.style.fontFamily = 'Arial, sans-serif';
    subtitleContainer.style.zIndex = '999999'; // On top of everything
    subtitleContainer.style.textAlign = 'center';
    subtitleContainer.style.pointerEvents = 'none'; // Click through it
    subtitleContainer.style.maxWidth = '80%';
    subtitleContainer.style.transition = 'opacity 0.3s ease';
    subtitleContainer.style.textShadow = '2px 2px 2px #000';

    document.body.appendChild(subtitleContainer);
}

// Prevent Multiple Listeners (The cause of "3x Text")
if (!window.hasVideoTranslatorListener) {
    window.hasVideoTranslatorListener = true;

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "SHOW_SUBTITLE") {
            console.log("SHOW_SUBTITLE received:", message.text); // DEBUG LOG
            createSubtitleContainer();

            // Deduplication: Don't show if exactly the same as the last line
            // (Just a safety check for offscreen jitter)
            let lastLine = subtitleContainer.lastElementChild;
            if (lastLine && lastLine.textContent === message.text) {
                return;
            }

            // "Tellus Style" - Accumulate text line by line
            // Only keep last 2-3 lines to avoid clutter

            let existingText = subtitleContainer.innerHTML;
            // Add new line
            let newBlock = `<div>${message.text}</div>`;
            subtitleContainer.innerHTML = existingText + newBlock;
            subtitleContainer.style.opacity = '1';

            // Limit to last 3 lines
            let lines = subtitleContainer.querySelectorAll('div');
            if (lines.length > 3) {
                lines[0].remove();
            }

            // Clear previous fade timer
            if (fadeTimeout) clearTimeout(fadeTimeout);

            // Fade out after 7 seconds
            fadeTimeout = setTimeout(() => {
                subtitleContainer.style.opacity = '0';
                subtitleContainer.innerHTML = ""; // Clear history on fade
            }, 7000);
        }
    });
}
