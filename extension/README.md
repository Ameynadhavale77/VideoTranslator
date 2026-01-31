# 🎙️ Live Video Call Translator (Chrome Extension)

> **Hackathon Project**: Breaking language barriers in real-time video calls (Google Meet, Zoom, YouTube) using AI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Chrome](https://img.shields.io/badge/platform-Chrome_Extension-green.svg)
![AI](https://img.shields.io/badge/AI-Deepgram_%2B_Google_Translate-purple.svg)

## 🚀 The Problem
In a globalized world, language barriers stop collaboration in video meetings. Existing tools are either expensive, platform-specific (like Zoom's paid plan), or have high latency.

## 💡 The Solution
A **Universal Chrome Extension** that works on ANY video site (YouTube, Meet, etc.). It captures the tab's audio, transcribes it instantly, and translates it to your preferred language using a hybrid AI pipeline.

**Key Features:**
*   **Universal Compatibility**: Works on any site with audio.
*   **Real-Time Transcription**: Powered by **Deepgram Nova-2** (Fastest model availble).
*   **Multi-Language Translation**: Hybrid bridge using **Google Translate API** for any-to-any translation (e.g., Hindi Audio -> English Text).
*   **Zero-Lag UI**: Custom "History Mode" subtitles that stabilize text to prevent flickering.

---

## 🛠️ Tech Stack
*   **Frontend**: HTML5, CSS3, Vanilla JavaScript (Lightweight).
*   **Browser API**: Chrome Extensions Manifest V3 (TabCapture, Scripting, Offscreen Documents).
*   **AI Engine (Speech)**: Deepgram Streaming WebSocket API.
*   **AI Engine (Translation)**: Custom Google Translate Bridge (Client-Side).

---

## 📸 Screenshots
*(Add your screenshots here: 1. The Popup Menu, 2. The Subtitles in action on YouTube)*

---

## ⚡ How to Install (For Judges)

1.  **Clone this Repo**:
    ```bash
    git clone https://github.com/yourusername/video-call-translator.git
    ```
2.  **Open Chrome Extensions**:
    *   Go to `chrome://extensions` in your browser.
    *   Turn on **Developer Mode** (top right).
3.  **Load the Extension**:
    *   Click **Load Unpacked**.
    *   Select the folder `VideoTranslator-Final` from this repo.
4.  **Run It**:
    *   Open a YouTube video (e.g., a speech in Hindi).
    *   Click the Extension Icon.
    *   Select **From: Hindi** -> **To: English**.
    *   Enter your Deepgram API Key (or ask us for a demo key).
    *   Click **Start**.

---

## 🧠 Architecture
1.  **Popup**: User selects languages.
2.  **Background.js**: Coordinates the "Tab Capture" stream.
3.  **Offscreen.js**: The "Brain". Receives audio stream -> Sends to Deepgram -> Receives Text -> Sends to Google Translate -> Sends to Content Script.
4.  **Content.js**: The "UI". Draws the floating subtitle box on the video element.

---

## 🔮 Future Roadmap
*   **Speaker Diarization**: Detecting *who* is speaking in a meeting.
*   **Local AI**: Switching to OpenAI Whisper (WASM) for privacy-first offline translation.
*   **Meeting Notes**: Auto-saving the transcript as a PDF after the meeting.
