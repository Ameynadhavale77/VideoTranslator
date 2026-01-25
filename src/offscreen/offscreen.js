// src/offscreen/offscreen.js

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.action === "START_RECORDING_OFFSCREEN") {
        startRecording(message.streamId, message.apiKey, message.language, message.targetLanguage);
    } else if (message.action === "STOP_RECORDING_OFFSCREEN") {
        stopRecording();
    }
});

let mediaStream = null;
let mediaRecorder = null;
let socket = null;
let audioContext = null;

async function startRecording(streamId, apiKey, language, targetLanguage) {
    try {
        console.log("Starting recording with streamId:", streamId);

        // 1. Get the MediaStream using the ID from background
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            },
            video: false
        });

        // 2. Play audio locally so user can hear it
        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(mediaStream);
        source.connect(audioContext.destination);

        // 3. Connect to Deepgram
        // interim_results=true forces Deepgram to send text while the person is still speaking
        const langCode = language || 'en';
        // Sanitize API key (remove spaces)
        const safeKey = apiKey.trim();

        // Pass Key in Subprotocol (Standard for Deepgram) but TRIMMED to avoid SyntaxError
        const deepgramUrl = `wss://api.deepgram.com/v1/listen?smart_format=true&language=${langCode}&model=nova-2&interim_results=true`;

        console.log("Connecting to Deepgram with Key:", safeKey.substring(0, 5) + "...");
        socket = new WebSocket(deepgramUrl, ['token', safeKey]);

        socket.onopen = () => {
            console.log("Connected to Deepgram");

            // 4. Start MediaRecorder to send audio chunks
            mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });

            mediaRecorder.addEventListener('dataavailable', event => {
                if (event.data.size > 0 && socket.readyState === 1) {
                    socket.send(event.data);
                }
            });

            mediaRecorder.start(100); // Send chunks every 100ms for lower latency
        };

        // Helper function for Translation
        async function translateText(text, sourceLang, targetLang) {
            try {
                // Use Google Translate 'gtx' endpoint (Free)
                // Map generic codes if needed (e.g. 'zh' -> 'zh-CN')
                let sl = sourceLang === 'zh' ? 'zh-CN' : sourceLang;
                let tl = targetLang === 'zh' ? 'zh-CN' : targetLang;

                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;

                const res = await fetch(url);
                const data = await res.json();

                if (data && data[0]) {
                    return data[0].map(s => s[0]).join('');
                }
                return text;
            } catch (err) {
                console.error("Translation API failed:", err);
                return text;
            }
        }

        // Buffer for stability
        let currentSentenceBuffer = "";

        socket.onmessage = async (message) => {
            const received = JSON.parse(message.data);
            const transcript = received.channel?.alternatives[0]?.transcript;
            const isFinal = received.is_final;

            if (transcript) {
                // STABILITY UPGRADE:
                // We IGNORE partial "interim" results for the display to prevent jumping.
                // We wait for Deepgram to say "is_final", meaning the sentence is grammatically complete.

                if (isFinal) {
                    let finalOutput = transcript;

                    // CHECK: Do we need to translate?
                    if (targetLanguage && targetLanguage !== 'same' && targetLanguage !== langCode) {
                        if (finalOutput.trim().length > 0) {
                            finalOutput = await translateText(finalOutput, langCode, targetLanguage);
                        }
                    }

                    // Only send if we actually have text
                    if (finalOutput.trim().length > 0) {
                        chrome.runtime.sendMessage({
                            action: "TRANSCRIPT_RECEIVED",
                            text: finalOutput,
                            isFinal: true
                        });
                    }
                }
            }
        };

        socket.onclose = () => {
            console.log("Deepgram connection closed");
        };

        socket.onerror = (error) => {
            console.error("Deepgram error:", error);
        };

    } catch (err) {
        console.error("Error in offscreen:", err.name, err.message);
        // Relay detailed error back to background/console
        chrome.runtime.sendMessage({
            action: "LOG_ERROR",
            error: `Offscreen Capture Error: ${err.name} - ${err.message}`
        });
    }
}

function stopRecording() {
    console.log("Stopping recording...");
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    if (socket) {
        socket.close();
        socket = null;
    }
}
