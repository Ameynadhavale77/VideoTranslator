// src/offscreen/offscreen.js

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.action === "START_RECORDING_OFFSCREEN") {
        startRecording(message.streamId, message.language, message.targetLanguage, message.token);
    } else if (message.action === "STOP_RECORDING_OFFSCREEN") {
        stopRecording();
    }
});

let mediaStream = null;
let mediaRecorder = null;
let audioContext = null;
let isRecording = false;

// Helpers to convert Blob to Base64
const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result.split(',')[1]; // Remove "data:audio/webm;base64," header
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

async function translateText(text, sourceLang, targetLang) {
    try {
        let sl = sourceLang === 'zh' ? 'zh-CN' : sourceLang;
        let tl = targetLang === 'zh' ? 'zh-CN' : targetLang;
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data[0]) return data[0].map(s => s[0]).join('');
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

        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            },
            video: false
        });

        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(mediaStream);
        source.connect(audioContext.destination);

        // --- NEW LOGIC: Restart Recorder Every Cycle ---
        // This ensures every blob is a standalone file with a valid Header.

        const sendChunk = async (blob) => {
            if (blob.size > 0 && isRecording) {
                try {
                    const base64Audio = await blobToBase64(blob);

                    const response = await fetch('http://localhost:3000/api/proxy', {
                        method: 'POST',
                        body: JSON.stringify({
                            audio: base64Audio,
                            language: language,
                            targetLanguage: targetLanguage,
                            token: token // Send Auth Token
                        })
                    });

                    const result = await response.json();

                    if (result.transcript) {
                        let finalOutput = result.transcript;
                        if (targetLanguage && targetLanguage !== 'same' && targetLanguage !== language) {
                            finalOutput = await translateText(finalOutput, language, targetLanguage);
                        }
                        if (finalOutput.trim().length > 0) {
                            chrome.runtime.sendMessage({
                                action: "TRANSCRIPT_RECEIVED",
                                text: finalOutput,
                                isFinal: true
                            });
                        }
                    }
                } catch (e) {
                    console.error("Error sending chunk to proxy:", e);
                }
            }
        };

        const recordCycle = () => {
            if (!isRecording) return;

            // Create NEW recorder each time
            mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });

            mediaRecorder.addEventListener('dataavailable', event => {
                sendChunk(event.data);
            });

            mediaRecorder.start();

            // Stop after 2 seconds (triggering dataavailable)
            setTimeout(() => {
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                }
                // Schedule next cycle
                if (isRecording) {
                    setTimeout(recordCycle, 50);
                }
            }, 2000);
        };

        recordCycle();

    } catch (err) {
        console.error("Error in offscreen:", err);
        chrome.runtime.sendMessage({ action: "LOG_ERROR", error: err.message });
    }
}

function stopRecording() {
    isRecording = false;
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
