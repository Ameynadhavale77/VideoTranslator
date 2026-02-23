// src/offscreen/offscreen.js

const subtitleChannel = new BroadcastChannel('translator_channel');

// STITCHING BUFFER STATE
let transcriptBuffer = "";
let currentChunkId = Date.now(); // Unique ID for current sentence
let currentToken = null; // Store for history save

// HISTORY LOG (Zero-impact: just accumulates text in memory)
let historyLog = [];
let historyStartTime = 0;

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
        currentToken = token; // Save for history
        historyLog = []; // Reset history log
        historyStartTime = Date.now();
        let consecutiveErrors = 0; // Track consecutive proxy failures

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

        // Monitor stream health — detect if tab audio capture dies
        mediaStream.getTracks().forEach(track => {
            track.onended = () => {
                console.error("⚠️ MediaStream track ended unexpectedly!");
                if (isRecording) {
                    chrome.runtime.sendMessage({
                        action: "TRANSCRIPT_RECEIVED",
                        chunkId: Date.now(),
                        text: "⚠️ Audio stream lost. Please restart.",
                        isFinal: true
                    });
                    stopRecording();
                }
            };
        });

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
                        consecutiveErrors++;
                        console.warn(`Proxy Error (${response.status}): ${response.statusText} [${consecutiveErrors} consecutive]`);
                        if (consecutiveErrors >= 5) {
                            chrome.runtime.sendMessage({
                                action: "TRANSCRIPT_RECEIVED",
                                chunkId: Date.now(),
                                text: "⚠️ Server errors detected. Subtitles may be delayed.",
                                isFinal: true
                            });
                            consecutiveErrors = 0; // Reset after warning
                        }
                        return; // Skip this chunk if server fails
                    }

                    consecutiveErrors = 0; // Reset on success

                    const result = await response.json();

                    if (result.transcript && result.transcript.trim().length > 0) {
                        let newText = result.transcript.trim();

                        // Strip trailing dots — STT adds a period to every 1s chunk
                        // which causes choppy subtitle breaks. Keep ? and ! as real endings.
                        newText = newText.replace(/\.+$/, '');

                        if (newText.length === 0) return; // Was just dots

                        // HISTORY: Accumulate raw transcript (zero-cost)
                        historyLog.push({
                            text: newText,
                            timestamp: (Date.now() - historyStartTime) / 1000
                        });

                        // Simple buffer: accumulate text, finalize by length or real punctuation
                        transcriptBuffer += " " + newText;
                        transcriptBuffer = transcriptBuffer.trim();

                        // Only ? and ! are real sentence endings (dots are STT artifacts)
                        const sentenceEnd = /[?!。！？]$/;
                        const hasPunctuation = sentenceEnd.test(transcriptBuffer);
                        const tooLong = transcriptBuffer.length > 120;

                        if (hasPunctuation || tooLong) {
                            // We have a complete thought — send it as final
                            let textToShow = transcriptBuffer;

                            // Translate if needed
                            if (targetLanguage && targetLanguage !== 'same' && targetLanguage !== language) {
                                textToShow = await translateText(textToShow, language, targetLanguage);
                            }

                            chrome.runtime.sendMessage({
                                action: "TRANSCRIPT_RECEIVED",
                                chunkId: currentChunkId,
                                text: textToShow,
                                isFinal: true
                            });

                            // Reset for next sentence
                            transcriptBuffer = "";
                            currentChunkId = Date.now();
                        } else {
                            // Still accumulating — show as live preview (update in place)
                            let textToShow = transcriptBuffer;

                            if (targetLanguage && targetLanguage !== 'same' && targetLanguage !== language) {
                                textToShow = await translateText(textToShow, language, targetLanguage);
                            }

                            chrome.runtime.sendMessage({
                                action: "TRANSCRIPT_RECEIVED",
                                chunkId: currentChunkId, // Same ID = updates in place, no new div
                                text: textToShow,
                                isFinal: false
                            });
                        }
                    }

                } catch (e) {
                    console.error("Fetch/Network Error (Skipping Chunk):", e);
                }
            }
        };

        const recordCycle = () => {
            if (!isRecording) return;

            // Check if stream is still alive before recording
            if (!mediaStream || mediaStream.getTracks().every(t => t.readyState === 'ended')) {
                console.error("⚠️ Stream died — stopping recording cycle.");
                stopRecording();
                return;
            }

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
                    setTimeout(recordCycle, 10);
                }
            }, 1000);
        };

        recordCycle();

    } catch (err) {
        console.error("Error in offscreen:", err);
        chrome.runtime.sendMessage({ action: "LOG_ERROR", error: err.message });
    }
}

async function stopRecording() {
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

    // Save meeting history (AWAIT so offscreen stays alive until done)
    if (currentToken && historyLog.length > 0) {
        await saveHistory(currentToken, historyLog);
    }
    currentToken = null;
    historyLog = [];

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

    // Signal background that cleanup is complete — safe to close offscreen
    chrome.runtime.sendMessage({ action: "OFFSCREEN_CLEANUP_DONE" }).catch(() => { });
}

// --- HISTORY: Save transcript to server (one API call, after stop) ---
async function saveHistory(token, log) {
    try {
        console.log(`Saving meeting history (${log.length} chunks)...`);
        const res = await fetch(`${APP_URL}/api/history/end`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: token,
                transcript: log
            })
        });
        const data = await res.json();
        if (data.success) {
            console.log("Meeting history saved!", data.sessionId, "AI:", data.aiDebug);
        } else {
            console.warn("History save failed:", data.error, JSON.stringify(data));
        }
    } catch (err) {
        console.error("History Save Error:", err);
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
