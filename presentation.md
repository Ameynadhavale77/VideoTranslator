# Presentation Slides — Any Video Translator

---

## Slide 1: Problem Statement

### The Problem

- **800M+ people** attend video meetings in a non-native language daily
- Existing subtitle tools are **platform-locked** — Zoom's works only on Zoom, Meet's only on Meet
- **No universal solution** works across YouTube, Netflix, Zoom, Meet, Teams, and other sites
- Meeting transcripts are **lost forever** — no one takes notes, decisions are forgotten
- Current tools are **expensive** ($20-30/month) with **high latency** (3-5 sec delay)

### The Gap

| What Users Need | What Exists Today |
|----------------|-------------------|
| One tool for ALL video sites | Separate tools per platform |
| Instant subtitles (<1 sec) | 3-5 second delay |
| Auto-generated meeting notes | Manual note-taking |
| Affordable pricing | $20-30/month subscriptions |
| Works on entertainment + work | Either work OR entertainment |

---

## Slide 2: Proposed Solution / Approach

### Our Solution: Any Video Translator

A **Chrome Extension** that captures any tab's audio, transcribes it in real-time, translates it, and generates AI-powered meeting notes — all in one tool.

**Approach:**

| Step | What Happens | Technology |
|------|-------------|-----------|
| 1. Capture | User clicks "Start" → tab audio captured | Chrome TabCapture API |
| 2. Transcribe | 1-second audio chunks → instant text | Deepgram Nova-3 |
| 3. Translate | Source language → target language | Google Translate (client-side) |
| 4. Display | Floating subtitle overlay on video | Content Script injection |
| 5. Save | On stop → full transcript saved | Supabase PostgreSQL |
| 6. Analyze | AI generates summary + key points + action items | Groq (Llama 3.3 70B) |

**Zero-Impact Design:**
- No 2nd API call during recording — transcripts accumulate in memory
- AI analysis happens **once** on stop, not during the session
- Result: **zero latency impact** on the main subtitle pipeline

---

## Slide 3: Technical Architecture & Tech Stack & AI Models

### Architecture

```
  USER clicks "Start"
        │
        ▼
┌─────────────────────────────────┐
│      Chrome Extension (MV3)     │
│  Popup → Background → Offscreen │
│              │                  │
│        Tab Audio Capture        │
│         (1s chunks)             │
│              │                  │
│    Content.js ← Subtitles       │
│   (Floating UI)                 │
└──────────┬──────────────────────┘
           │ Base64 audio
           ▼
┌─────────────────────────────────┐
│     Vercel (Next.js API)        │
│                                 │
│  /api/proxy ──→ Deepgram Nova-3 │
│                   (STT)         │
│                                 │
│  /api/history/end ──→ Groq AI   │
│                    (Llama 3.3)  │
│         │                       │
│         ▼                       │
│     Supabase (PostgreSQL)       │
│     Sessions + Transcripts      │
│     + Auth + Credits            │
└─────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│    Dashboard (Next.js SSR)      │
│  AI Summary | Key Points        │
│  Action Items | Full Transcript  │
└─────────────────────────────────┘
```

### Tech Stack & AI Models

| Layer | Technology | Role |
|-------|-----------|------|
| Extension | Chrome Manifest V3 | TabCapture + Offscreen Documents |
| Frontend | Vanilla JS + HTML5 | Lightweight, no framework overhead |
| Backend | Next.js 16 on Vercel | Serverless API routes (60s timeout) |
| Database | Supabase (PostgreSQL) | Auth + Row-Level Security + Storage |
| Payments | Razorpay | UPI + Cards for Indian market |

| AI Model | Task | Speed | Cost |
|----------|------|-------|------|
| **Deepgram Nova-3** | Speech → Text | ~300ms | $0.0043/min |
| **Google Translate** | Text → Translation | Instant | Free (client-side) |
| **Groq Llama 3.3 70B** | Summary + Key Points + Actions | ~2 sec | Free (30 RPM) |

---

## Slide 4: Key Features (Comparison)

### How We Compare

| Feature | Any Video Translator | Zoom Captions | Google Meet CC | Otter.ai | Rev |
|---------|:-------------------:|:------------:|:--------------:|:--------:|:---:|
| **Works on ANY website** | ✅ | ❌ Zoom only | ❌ Meet only | ❌ Meet/Zoom | ❌ Upload only |
| **Real-time subtitles** | ✅ (<1s) | ✅ (~2s) | ✅ (~1s) | ✅ (~2s) | ❌ Post-process |
| **Multi-language translation** | ✅ 100+ langs | ❌ | ✅ Limited | ❌ English only | ❌ English only |
| **YouTube / Netflix support** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **AI Meeting Summary** | ✅ Auto-generated | ❌ | ❌ | ✅ ($16.99/mo) | ✅ ($29.99/mo) |
| **Key Points extraction** | ✅ | ❌ | ❌ | ✅ (paid) | ❌ |
| **Action Items with owners** | ✅ | ❌ | ❌ | ✅ (paid) | ❌ |
| **Saved transcripts** | ✅ Free | ❌ | ❌ | ✅ (paid) | ✅ (paid) |
| **Personal dashboard** | ✅ | ❌ | ❌ | ✅ (paid) | ✅ (paid) |
| **Pricing** | ₹49 / 60 min | Free (no translate) | Free (no save) | $16.99/mo | $29.99/mo |

### Our Unique Advantage
> **Only tool that combines universal site support + real-time translation + AI meeting notes — at a fraction of the cost.**

---

## Slide 5: Business Model

### Revenue Model: Pay-as-You-Go Credits

| Plan | Credits | Price | Per Minute |
|------|---------|-------|-----------|
| Starter | 30 min | ₹29 | ₹0.97/min |
| Regular | 60 min | ₹49 | ₹0.82/min |
| Power | 180 min | ₹129 | ₹0.72/min |
| Enterprise | Custom | Contact us | Volume pricing |

**Why Credits > Subscription:**
- No recurring cost for casual users
- Students & freelancers can start small
- Power users save more with larger packs
- Zero waste — pay only for what you use

### Cost Structure (Per Minute of Translation)

| Cost Item | Cost/Min | % of Revenue |
|-----------|----------|-------------|
| Deepgram Nova-3 (STT) | ₹0.36 | 44% |
| Groq AI (Summary) | ₹0.00 | 0% (free tier) |
| Vercel (Hosting) | ₹0.02 | 2% |
| Supabase (DB) | ₹0.01 | 1% |
| **Total Cost** | **₹0.39** | **~48%** |
| **Gross Margin** | **₹0.43** | **~52%** |

### Target Market
- 🎓 **Students** — Translate lectures, educational videos
- 💼 **Remote workers** — Multilingual meetings on Zoom/Meet
- 🎬 **Entertainment users** — Watch foreign content on Netflix/YouTube
- 🏢 **Small businesses** — Affordable alternative to Otter.ai/Rev

---

## Slide 6: References

### Technologies & APIs
1. **Deepgram Nova-3** — deepgram.com — State-of-the-art speech recognition model
2. **Groq Cloud** — groq.com — Ultra-fast LLM inference (Llama 3.3 70B)
3. **Google Translate** — Client-side translation API (100+ languages)
4. **Chrome Extensions MV3** — developer.chrome.com/docs/extensions/mv3
5. **Supabase** — supabase.com — Open-source Firebase alternative (PostgreSQL + Auth)
6. **Next.js 16** — nextjs.org — React framework for serverless API routes
7. **Vercel** — vercel.com — Edge deployment platform
8. **Razorpay** — razorpay.com — Payment gateway (UPI + Cards)

### Research & Inspiration
9. **"The State of Remote Work 2024"** — Buffer — 78% of remote workers face language barriers
10. **"Speech Recognition Accuracy Benchmarks"** — Deepgram — Nova-3 achieves 8.5% WER (Word Error Rate)
11. **Chrome TabCapture API** — developer.chrome.com/docs/extensions/reference/tabCapture
12. **Offscreen Documents** — developer.chrome.com/docs/extensions/reference/offscreen

### Live Links
- 🌐 **Website:** anyvideotranslator.com
- 📦 **GitHub:** github.com/Ameynadhavale77/VideoTranslator
- 🏪 **Chrome Web Store:** *(publishing in progress)*
