import { NextResponse } from 'next/server';
import { getSupabaseClient, getSupabaseAdmin } from '@/lib/supabase'; // Import the client

// Node.js runtime (60s timeout, full Buffer support)

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
    try {
        const apiKey = process.env.DEEPGRAM_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Server Error: Missing Key" }, { status: 500, headers: corsHeaders });
        }

        // 1. Get the chunk data & token
        const { audio, language, targetLanguage, token } = await req.json();

        // --- AUTH CHECK ---
        let userId = null;
        if (token) {
            const supabase = getSupabaseClient();
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                userId = user.id;
                console.log(`✅ Authorized User: ${user.email}`);
            } else {
                console.warn("❌ Invalid Token");
                // For Phase 2, we can return 401, or just allow it as "Guest" to not break demo?
                // "The Business" phase implies we MUST enforce it.
                // return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        // Ensure User is logged in (Enforcing Phase 2)
        if (!userId) {
            return NextResponse.json({ error: "Please Log In to the Extension first." }, { status: 401, headers: corsHeaders });
        }

        // --- CREDIT CHECK & DEDUCTION ---
        const admin = getSupabaseAdmin();

        // 1. Check Balance
        const { data: creditData, error: creditError } = await admin
            .from('credits')
            .select('balance_seconds')
            .eq('user_id', userId)
            .single();

        if (creditError || !creditData) {
            console.error("Credit Check Error:", creditError);
            // If table doesn't exist or user not found in credits, defaulting to error.
            return NextResponse.json({ error: "Account Error: No credits found" }, { status: 402 });
        }

        if (creditData.balance_seconds <= 0) {
            return NextResponse.json({ error: "Out of Credits! Please top up.", code: "NO_CREDITS" }, { status: 402, headers: corsHeaders });
        }

        if (!audio) {
            return NextResponse.json({ error: "No audio data" }, { status: 400 });
        }

        // 2. Decode Base64 audio to Buffer
        const audioBuffer = Buffer.from(audio, 'base64');

        // --- SMART ROUTING: Indian languages → Sarvam AI, Others → Deepgram ---
        const SARVAM_LANGS: Record<string, string> = {
            'hi': 'hi-IN', 'ta': 'ta-IN', 'te': 'te-IN', 'mr': 'mr-IN',
            'gu': 'gu-IN', 'bn': 'bn-IN', 'kn': 'kn-IN', 'ml': 'ml-IN',
            'pa': 'pa-IN', 'od': 'od-IN', 'ur': 'ur-IN'
        };

        const useSarvam = SARVAM_LANGS[language] && process.env.SARVAM_API_KEY;
        let transcript = "";

        if (useSarvam) {
            // --- SARVAM AI (Indian Languages) ---
            const sarvamKey = process.env.SARVAM_API_KEY!;
            const langCode = SARVAM_LANGS[language];

            // Sarvam expects multipart/form-data with a file
            const formData = new FormData();
            const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
            formData.append('file', audioBlob, 'audio.webm');
            formData.append('model', 'saaras:v3');
            formData.append('language_code', langCode);

            const sarvamResponse = await fetch('https://api.sarvam.ai/speech-to-text', {
                method: 'POST',
                headers: {
                    'api-subscription-key': sarvamKey
                },
                body: formData
            });

            if (sarvamResponse.ok) {
                const sarvamResult = await sarvamResponse.json();
                transcript = sarvamResult.transcript || "";
                console.log(`🇮🇳 Sarvam (${langCode}): "${transcript.substring(0, 80)}"`);
            } else {
                // Fallback to Deepgram if Sarvam fails
                console.warn(`Sarvam Error ${sarvamResponse.status}, falling back to Deepgram`);
                const dgUrl = `https://api.deepgram.com/v1/listen?smart_format=true&model=nova-3&language=${language || 'en'}`;
                const dgResp = await fetch(dgUrl, {
                    method: "POST",
                    headers: { "Authorization": `Token ${apiKey}`, "Content-Type": "audio/webm" },
                    body: audioBuffer
                });
                if (dgResp.ok) {
                    const dgResult = await dgResp.json();
                    transcript = dgResult.results?.channels[0]?.alternatives[0]?.transcript || "";
                }
            }
        } else {
            // --- DEEPGRAM (Global Languages) ---
            const deepgramUrl = `https://api.deepgram.com/v1/listen?smart_format=true&model=nova-3&language=${language || 'en'}`;

            const dgResponse = await fetch(deepgramUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Token ${apiKey}`,
                    "Content-Type": "audio/webm",
                },
                body: audioBuffer
            });

            if (!dgResponse.ok) {
                console.error(`Deepgram Error: ${dgResponse.status} ${dgResponse.statusText}`);
                return NextResponse.json({ error: "Deepgram API Error" }, { status: 502, headers: corsHeaders });
            }

            const dgResult = await dgResponse.json();
            transcript = dgResult.results?.channels[0]?.alternatives[0]?.transcript || "";
        }

        // 5. Deduct Credits ONLY after successful response
        const DEDUCTION_AMOUNT = 2;
        await admin
            .from('credits')
            .update({ balance_seconds: creditData.balance_seconds - DEDUCTION_AMOUNT })
            .eq('user_id', userId);

        console.log(`💰 Deducted ${DEDUCTION_AMOUNT}s. Remaining: ${creditData.balance_seconds - DEDUCTION_AMOUNT}s`);

        return NextResponse.json({
            transcript: transcript,
            isFinal: true
        }, { headers: corsHeaders });

    } catch (error: any) {
        console.error("Proxy Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
}
