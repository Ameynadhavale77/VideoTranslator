import { NextResponse } from 'next/server';
import { getSupabaseClient, getSupabaseAdmin } from '@/lib/supabase'; // Import the client

export const runtime = 'edge';

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

        // 2. Deduct Credits (Approx 2 seconds per chunk)
        const DEDUCTION_AMOUNT = 2;
        await admin
            .from('credits')
            .update({ balance_seconds: creditData.balance_seconds - DEDUCTION_AMOUNT })
            .eq('user_id', userId);

        console.log(`💰 Deducted ${DEDUCTION_AMOUNT}s. Remaining: ${creditData.balance_seconds - DEDUCTION_AMOUNT}s`);

        if (!audio) {
            return NextResponse.json({ error: "No audio data" }, { status: 400 });
        }

        // 2. Decode Base64 audio to Buffer
        const audioBuffer = Buffer.from(audio, 'base64');

        // 3. Send to Deepgram (REST API for a single chunk)
        // Using Nova-3 as per latest upgrade
        const deepgramUrl = `https://api.deepgram.com/v1/listen?smart_format=true&model=nova-3&language=${language || 'en'}`;

        const dgResponse = await fetch(deepgramUrl, {
            method: "POST",
            headers: {
                "Authorization": `Token ${apiKey}`,
                "Content-Type": "audio/webm",
            },
            body: audioBuffer
        });

        const dgResult = await dgResponse.json();

        // 4. Return result (Pure Transcript)
        const transcript = dgResult.results?.channels[0]?.alternatives[0]?.transcript || "";

        return NextResponse.json({
            transcript: transcript,
            isFinal: true
        }, { headers: corsHeaders });

    } catch (error: any) {
        console.error("Proxy Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
}
