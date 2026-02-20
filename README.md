# 🎙️ Any Video Translator — AI-Powered Live Subtitles & Meeting History

> Real-time translated subtitles for **any** video site — YouTube, Netflix, Zoom, Google Meet, and more. Plus AI-powered meeting summaries, key points, and action items.

![Chrome](https://img.shields.io/badge/platform-Chrome_Extension-green.svg)
![AI](https://img.shields.io/badge/AI-Deepgram_Nova--3-purple.svg)
![Translation](https://img.shields.io/badge/Translation-Google_Translate-blue.svg)
![Summary](https://img.shields.io/badge/Summary-Groq_Llama_3.3-orange.svg)

🌐 **Live:** [anyvideotranslator.com](https://www.anyvideotranslator.com)

---

## 🚀 Features

### 🎬 Real-Time Subtitles
- **Universal** — Works on ANY website with audio (YouTube, Netflix, Zoom, Meet, etc.)
- **Fast** — 1-second audio chunks for near-instant subtitles
- **Accurate** — Powered by **Deepgram Nova-3** (state-of-the-art speech model)
- **Multi-Language** — Translate from any language to any language via Google Translate bridge

### 📝 Meeting History & AI Insights *(NEW)*
- **Auto-saved transcripts** — Every session is stored with timestamps
- **AI Summary** — 3-5 sentence overview of the conversation
- **Key Points** — 5-8 important discussion highlights
- **Action Items** — Tasks with owners extracted from the meeting
- **Zero performance impact** — Transcripts accumulate in memory, saved in one API call on stop
- **Powered by Groq** — Llama 3.3 70B for fast, high-quality AI analysis

### 🔐 User System
- **Supabase Auth** — Email/password login
- **Credit System** — Pay-per-use with Razorpay integration
- **Dashboard** — View all past sessions at [anyvideotranslator.com/dashboard](https://www.anyvideotranslator.com/dashboard)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | Chrome Manifest V3 (TabCapture, Offscreen Documents) |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Web App | Next.js 16 (App Router) |
| Speech AI | Deepgram Nova-3 (REST API) |
| Translation | Google Translate (Client-side bridge) |
| AI Summary | Groq API (Llama 3.3 70B) |
| Auth & DB | Supabase (PostgreSQL + Auth) |
| Payments | Razorpay |
| Hosting | Vercel |

---

## 🧠 Architecture

```
┌─────────────────────────────────────────────────┐
│                Chrome Extension                  │
│  ┌──────────┐  ┌────────────┐  ┌──────────────┐ │
│  │ Popup.js │  │ Background │  │ Content.js   │ │
│  │ (UI/Auth)│  │ (Coord.)   │  │ (Subtitles)  │ │
│  └──────────┘  └────────────┘  └──────────────┘ │
│                 ┌────────────┐                    │
│                 │ Offscreen  │ ← Audio capture    │
│                 │ (Brain)    │ → Transcript buffer │
│                 └─────┬──────┘ → History log      │
└───────────────────────┼──────────────────────────┘
                        │
                   ┌────▼────┐
                   │ Vercel  │
                   │ API     │
                   ├─────────┤
                   │/api/proxy     → Deepgram Nova-3
                   │/api/history   → Supabase + Groq AI
                   │/api/user      → Auth + Credits
                   └─────────┘
```

---

## ⚡ Setup

### 1. Clone & Install
```bash
git clone https://github.com/Ameynadhavale77/VideoTranslator.git
cd VideoTranslator
cd web && npm install
```

### 2. Environment Variables (Vercel)
```
DEEPGRAM_API_KEY=your_deepgram_key
GROQ_API_KEY=your_groq_key          # Free from console.groq.com
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_key
RAZORPAY_KEY_ID=your_key
RAZORPAY_KEY_SECRET=your_secret
```

### 3. Load the Extension
1. Go to `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load Unpacked** → select the `extension/` folder

### 4. Deploy Web App
```bash
cd web
npx vercel deploy --prod
```

---

## 📁 Project Structure
```
VideoTranslator-Final/
├── extension/                # Chrome Extension
│   ├── manifest.json
│   └── src/
│       ├── popup/            # Login, settings UI
│       ├── background/       # Tab capture coordinator
│       ├── offscreen/        # Audio processing + history
│       └── content/          # Subtitle injection
├── web/                      # Next.js Web App
│   ├── app/
│   │   ├── api/
│   │   │   ├── proxy/        # Deepgram transcription
│   │   │   ├── history/      # Meeting history + AI
│   │   │   ├── user/         # Auth + credits
│   │   │   └── payment/      # Razorpay integration
│   │   ├── dashboard/        # Meeting history UI
│   │   └── page.tsx          # Landing page
│   └── lib/supabase.ts       # DB client
└── history.sql               # Database schema
```

---

## 📄 License
MIT
