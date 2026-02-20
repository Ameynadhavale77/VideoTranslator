# Any Video Translator — Web App

Next.js backend & dashboard for the [Any Video Translator](https://www.anyvideotranslator.com) Chrome extension.

## What This Handles
- **`/api/proxy`** — Receives audio chunks from the extension, transcribes via Deepgram Nova-3
- **`/api/history/end`** — Saves meeting transcripts + generates AI summary via Groq (Llama 3.3 70B)
- **`/api/user/credits`** — Credit balance management
- **`/api/payment`** — Razorpay payment integration
- **`/dashboard`** — Meeting history list
- **`/dashboard/[id]`** — Session detail with transcript, AI summary, key points, action items

## Setup
```bash
npm install
cp .env.example .env.local  # Fill in your keys
npm run dev
```

## Deploy
```bash
npx vercel deploy --prod
```

## Environment Variables
| Variable | Source |
|----------|--------|
| `DEEPGRAM_API_KEY` | [deepgram.com](https://deepgram.com) |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) (free) |
| `NEXT_PUBLIC_SUPABASE_URL` | [supabase.com](https://supabase.com) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard |
| `RAZORPAY_KEY_ID` | [razorpay.com](https://razorpay.com) |
| `RAZORPAY_KEY_SECRET` | Razorpay dashboard |
