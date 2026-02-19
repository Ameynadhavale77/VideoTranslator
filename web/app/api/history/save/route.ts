import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'edge';

export async function POST(req: Request) {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    try {
        if (req.method === 'OPTIONS') {
            return NextResponse.json({}, { headers: corsHeaders });
        }

        const { audio, sessionId, token, chunkStartTime } = await req.json();

        // 1. Auth Check
        if (!token || !sessionId) {
            return NextResponse.json({ error: "Missing Token/Session" }, { status: 401, headers: corsHeaders });
        }

        const admin = getSupabaseAdmin();
        const { data: { user }, error: authError } = await admin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
        }

        // 2. Validate Session Ownership
        // (Optional: extra safety check)

        // 3. Deepgram Request (Nova-2 + Diarization)
        const apiKey = process.env.DEEPGRAM_API_KEY;
        const deepgramUrl = `https://api.deepgram.com/v1/listen?smart_format=true&model=nova-2&diarize=true&language=en`;

        const audioBuffer = Buffer.from(audio, 'base64');

        const dgResponse = await fetch(deepgramUrl, {
            method: "POST",
            headers: {
                "Authorization": `Token ${apiKey}`,
                "Content-Type": "audio/webm",
            },
            body: audioBuffer
        });

        const dgResult = await dgResponse.json();

        console.log("Deepgram Status:", dgResponse.status);
        if (dgResponse.status !== 200) {
            console.error("Deepgram Error:", JSON.stringify(dgResult));
            return NextResponse.json({ error: "Deepgram API Error" }, { status: 500, headers: corsHeaders });
        }

        // 4. Process Results (Speaker Segments)
        // We look for 'paragraphs' which group sentences by speaker
        const paragraphs = dgResult.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs;
        const transcriptRaw = dgResult.results?.channels?.[0]?.alternatives?.[0]?.transcript;

        console.log(`Transcript Length: ${transcriptRaw ? transcriptRaw.length : 0}`);
        console.log(`Paragraphs: ${paragraphs ? paragraphs.length : 0}`);

        if (!paragraphs && transcriptRaw) {
            // Fallback if diarization yields no speakers but we have text
            const timestamp = (chunkStartTime || 0); // No offset calc possible without words
            await admin.from('session_transcripts').insert({
                session_id: sessionId,
                speaker: "Speaker 0",
                text: transcriptRaw,
                timestamp: timestamp
            });
        } else if (paragraphs) {
            const rowsToInsert = paragraphs.map((p: any) => ({
                session_id: sessionId,
                speaker: `Speaker ${p.speaker}`,
                text: p.sentences.map((s: any) => s.text).join(' '),
                timestamp: (chunkStartTime || 0) + (p.start || 0)
            }));

            if (rowsToInsert.length > 0) {
                const { error: dbError } = await admin.from('session_transcripts').insert(rowsToInsert);
                if (dbError) {
                    console.error("DB Insert Error:", dbError);
                    throw new Error("DB Insert Failed");
                }
            }
        }

        return NextResponse.json({ success: true }, { headers: corsHeaders });

    } catch (error: any) {
        console.error("Save History Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
}
