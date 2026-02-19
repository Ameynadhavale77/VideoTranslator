// src/offscreen/offscreen.js

const subtitleChannel = new BroadcastChannel('translator_channel');

// STITCHING BUFFER STATE
let transcriptBuffer = "";
let currentChunkId = Date.now(); // Unique ID for current sentence
let currentToken = null; // Store for stopHistory

// GLOBAL STATE
let isRecording = false;
let mediaStream = null;
let mediaRecorder = null;
const APP_URL = "https://www.anyvideotranslator.com"; // Use "http://localhost:3000" for local dev

// GLOBAL STATE
let audioContext = null;

// Helper: Check for terminal punctuation (Includes commas now for faster chunks)
const isSentenceEnd = (text) => /[.?!,。！？，]$/.test(text.trim());

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function translateText(text, sourceLang, targetLang) {
    try {
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

async function startRecording(streamId, language, targetLanguage, token) {
    try {
        console.log("Starting Proxy recording...");
        isRecording = true;
        transcriptBuffer = ""; // Reset buffer
        currentChunkId = Date.now();
        currentToken = token; // Save for stop

        // Initialize MediaStream *BEFORE* AudioContext
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            },
            video: false
        });

        if (!mediaStream) {
            throw new Error("Failed to capture MediaStream");
        }

        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(mediaStream);
        source.connect(audioContext.destination);

        // Start Sidecar History (Now that we have a stream)
        // DISABLED FOR PERFORMANCE (User Request)
        // startHistory(token);

        const sendChunk = async (blob) => {
            if (blob.size > 0 && isRecording) {
                try {
                    const base64Audio = await blobToBase64(blob);

                    // Fetch with 1 retry on failure
                    let response;
                    for (let attempt = 0; attempt < 2; attempt++) {
                        try {
                            response = await fetch(`${APP_URL}/api/proxy`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    audio: base64Audio,
                                    language: language,
                                    targetLanguage: targetLanguage,
                                    token: token
                                })
                            });
                            break; // Success, exit retry loop
                        } catch (fetchErr) {
                            if (attempt === 0) {
                                console.warn("Fetch failed, retrying in 500ms...", fetchErr.message);
                                await new Promise(r => setTimeout(r, 500));
                            } else {
                                throw fetchErr; // 2nd attempt failed, bubble up
                            }
                        }
                    }

                    if (response.status === 401) {
                        console.error("Authentication Token Expired (401)");
                        chrome.runtime.sendMessage({ action: "AUTH_ERROR" });
                        stopRecording();
                        return;
                    }

                    if (!response.ok) {
                        console.warn(`Proxy Error (${response.status}): ${response.statusText}`);
                        return; // Skip this chunk if server fails
                    }

                    const result = await response.json();
                    // ... Process result ... (Logic remains same)
                    if (result.transcript && result.transcript.trim().length > 0) {
                        // ... transcript processing ...
                        let newText = result.transcript.trim();

                        // 1. Append to Buffer
                        transcriptBuffer += " " + newText;
                        transcriptBuffer = transcriptBuffer.trim();

                        // 2. Process Buffer: Look for "Split Points" (Punctuators)
                        const splitRegex = /(.*?[.?!,。！？，])\s*(.*)/s;

                        let match;
                        while ((match = transcriptBuffer.match(splitRegex)) !== null) {
                            // We found a split!
                            let finalPart = match[1].trim();
                            let remainder = match[2].trim();

                            // Translate Final Part
                            let translatedFinal = finalPart;
                            if (targetLanguage && targetLanguage !== 'same' && targetLanguage !== language) {
                                translatedFinal = await translateText(finalPart, language, targetLanguage);
                            }

                            // Send FINAL chunk
                            chrome.runtime.sendMessage({
                                action: "TRANSCRIPT_RECEIVED",
                                chunkId: currentChunkId,
                                text: translatedFinal,
                                isFinal: true
                            });

                            // Prepare for next chunk
                            currentChunkId = Date.now();
                            transcriptBuffer = remainder;
                        }

                        // 3. Handle Remaining Buffer (Interim)
                        if (transcriptBuffer.length > 0) {
                            let textToTranslate = transcriptBuffer;
                            if (targetLanguage && targetLanguage !== 'same' && targetLanguage !== language) {
                                textToTranslate = await translateText(textToTranslate, language, targetLanguage);
                            }

                            chrome.runtime.sendMessage({
                                action: "TRANSCRIPT_RECEIVED",
                                chunkId: currentChunkId,
                                text: textToTranslate,
                                isFinal: false
                            });
                        }

                        // 4. Force Finalize if Buffer is too long (Safety Valve & Wrapping)
                        const MAX_CHUNK_LENGTH = 80;

                        if (transcriptBuffer.length > MAX_CHUNK_LENGTH) {
                            // Find last space within the safe zone
                            let lastSpaceIndex = transcriptBuffer.lastIndexOf(' ', MAX_CHUNK_LENGTH);

                            if (lastSpaceIndex > -1) {
                                // Split at space!
                                let finalPart = transcriptBuffer.substring(0, lastSpaceIndex).trim();
                                let remainder = transcriptBuffer.substring(lastSpaceIndex + 1).trim();

                                // Translate
                                let translatedFinal = finalPart;
                                if (targetLanguage && targetLanguage !== 'same' && targetLanguage !== language) {
                                    translatedFinal = await translateText(finalPart, language, targetLanguage);
                                }

                                // Send FINAL chunk
                                chrome.runtime.sendMessage({
                                    action: "TRANSCRIPT_RECEIVED",
                                    chunkId: currentChunkId,
                                    text: translatedFinal,
                                    isFinal: true
                                });

                                // Update Buffer
                                transcriptBuffer = remainder;
                                currentChunkId = Date.now();
                            } else {
                                // Force dump at index 80
                                chrome.runtime.sendMessage({
                                    action: "TRANSCRIPT_RECEIVED",
                                    chunkId: currentChunkId,
                                    text: transcriptBuffer,
                                    isFinal: true
                                });
                                transcriptBuffer = "";
                                currentChunkId = Date.now();
                            }
                        }
                    }

                } catch (e) {
                    console.error("Fetch/Network Error (Skipping Chunk):", e);
                }
            }
        };

        const recordCycle = () => {
            if (!isRecording) return;

            mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });

            mediaRecorder.addEventListener('dataavailable', event => {
                sendChunk(event.data);
            });

            mediaRecorder.start();

            // Stop after 1 second (1000ms) for faster latency
            setTimeout(() => {
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                }
                // Schedule next cycle
                if (isRecording) {
                    // Reduced gap from 50ms -> 10ms for faster response
                    setTimeout(recordCycle, 10);
                }
            }, 1000); // CHANGED FROM 2000 TO 1000
        };

        recordCycle();

    } catch (err) {
        console.error("Error in offscreen:", err);
        chrome.runtime.sendMessage({ action: "LOG_ERROR", error: err.message });
    }
}

function stopRecording() {
    isRecording = false;

    // Flush remaining buffer as FINAL before clearing
    if (transcriptBuffer.trim().length > 0) {
        chrome.runtime.sendMessage({
            action: "TRANSCRIPT_RECEIVED",
            chunkId: currentChunkId,
            text: transcriptBuffer.trim(),
            isFinal: true
        });
    }
    transcriptBuffer = ""; // Clear buffer

    // Stop Sidecar History
    if (currentToken) {
        stopHistory(currentToken);
        currentToken = null;
    }

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
}

// --- SIDECAR PIPELINE (HISTORY) ---
let historyRecorder = null;
let historySessionId = null;
let historyStartTime = 0;

async function startHistory(token) {
    try {
        console.log("Starting History Sidecar...");
        historyStartTime = Date.now();

        // 1. Create Session
        const res = await fetch(`${APP_URL}/api/history/start`, {
            method: 'POST',
            body: JSON.stringify({ token: token })
        });
        const data = await res.json();

        if (data.sessionId) {
            historySessionId = data.sessionId;
            console.log("History Session ID:", historySessionId);

            // 2. Start Slow Recorder (15s chunks)
            historyRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });

            historyRecorder.addEventListener('dataavailable', async (event) => {
                if (event.data.size > 0 && historySessionId) {
                    const chunkStart = (Date.now() - historyStartTime - 15000) / 1000; // Approx start of this 15s chunk
                    const safeStart = Math.max(0, chunkStart);

                    const blob = event.data;
                    const base64 = await blobToBase64(blob);

                    // Fire & Forget (Sidecar)
                    fetch(`${APP_URL}/api/history/save`, {
                        method: 'POST',
                        body: JSON.stringify({
                            audio: base64,
                            sessionId: historySessionId,
                            token: token,
                            chunkStartTime: safeStart
                        })
                    }).catch(err => console.error("History Save Error:", err));
                }
            });

            // Start with 15s timeslice
            historyRecorder.start(15000);
        }
    } catch (error) {
        console.error("History Start Failed:", error);
    }
}

function stopHistory(token) {
    if (historyRecorder && historyRecorder.state !== 'inactive') {
        historyRecorder.stop();
    }

    if (historySessionId) {
        console.log("Ending History Session...");
        fetch(`${APP_URL}/api/history/end`, {
            method: 'POST',
            body: JSON.stringify({
                sessionId: historySessionId,
                token: token
            })
        }).catch(err => console.error("History End Error:", err));

        historySessionId = null;
        historyRecorder = null;
    }
}

// Listen for messages from Background Script
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "START_RECORDING_OFFSCREEN") {
        startRecording(message.streamId, message.language, message.targetLanguage, message.token);
    } else if (message.action === "STOP_RECORDING_OFFSCREEN") {
        stopRecording();
    }
});
