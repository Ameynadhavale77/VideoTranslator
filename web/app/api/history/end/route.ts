import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

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
        const { token, transcript } = await req.json();

        if (!token || !transcript || transcript.length === 0) {
            return NextResponse.json({ error: "Missing token or transcript" }, { status: 400, headers: corsHeaders });
        }

        // 1. Auth Check
        const admin = getSupabaseAdmin();
        const { data: { user }, error: authError } = await admin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
        }

        // 2. Create Session
        const sessionTitle = `Meeting on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

        const { data: sessionData, error: sessionError } = await admin
            .from('sessions')
            .insert({
                user_id: user.id,
                title: sessionTitle,
                started_at: new Date(Date.now() - (transcript[transcript.length - 1].timestamp * 1000)).toISOString(),
                ended_at: new Date().toISOString(),
                status: 'processing'
            })
            .select()
            .single();

        if (sessionError || !sessionData) {
            console.error("Session Create Error:", sessionError);
            return NextResponse.json({ error: "Failed to create session" }, { status: 500, headers: corsHeaders });
        }

        const sessionId = sessionData.id;
        console.log(`Session created: ${sessionId} for ${user.email}`);

        // 3. Save Transcripts
        const transcriptRows = transcript.map((t: { text: string; timestamp: number }) => ({
            session_id: sessionId,
            speaker: "Speaker",
            text: t.text,
            timestamp: t.timestamp
        }));

        const { error: insertError } = await admin.from('session_transcripts').insert(transcriptRows);
        if (insertError) {
            console.error("Transcript Insert Error:", insertError);
        }

        // 4. Generate AI Summary (Gemini) — fire & forget style
        const geminiKey = process.env.GEMINI_API_KEY;
        if (geminiKey) {
            try {
                const fullText = transcript.map((t: { text: string; timestamp: number }) =>
                    `[${Math.floor(t.timestamp)}s] ${t.text}`
                ).join('\n');

                // Truncate for safety (Gemini handles ~1M tokens but keep it reasonable)
                const truncatedText = fullText.substring(0, 30000);

                const prompt = `You are an expert Meeting Assistant. Analyze the following transcript and provide:
1. A concise "summary" (3-5 sentences capturing the main discussion).
2. A list of "key_points" (5-8 important discussion points as strings).
3. A list of "action_items" (tasks that need to be done, each with "task" and "owner" fields).

Transcript:
${truncatedText}

Return ONLY valid JSON in this exact format:
{
  "summary": "...",
  "key_points": ["point 1", "point 2"],
  "action_items": [{"task": "...", "owner": "..."}]
}`;

                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;

                const aiResponse = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            responseMimeType: "application/json"
                        }
                    })
                });

                if (aiResponse.ok) {
                    const aiData = await aiResponse.json();
                    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

                    if (content) {
                        const result = JSON.parse(content);

                        await admin
                            .from('sessions')
                            .update({
                                ai_summary: result.summary || null,
                                action_items: {
                                    key_points: result.key_points || [],
                                    action_items: result.action_items || []
                                },
                                status: 'completed'
                            })
                            .eq('id', sessionId);

                        console.log("AI Summary generated & saved!");
                    }
                } else {
                    console.warn("Gemini API Failed:", await aiResponse.text());
                    // Still mark as completed even without AI
                    await admin.from('sessions').update({ status: 'completed' }).eq('id', sessionId);
                }
            } catch (aiErr: any) {
                console.error("AI Generation Error:", aiErr.message);
                await admin.from('sessions').update({ status: 'completed' }).eq('id', sessionId);
            }
        } else {
            // No API key — just mark as completed
            await admin.from('sessions').update({ status: 'completed' }).eq('id', sessionId);
        }

        return NextResponse.json({ success: true, sessionId: sessionId }, { headers: corsHeaders });

    } catch (error: any) {
        console.error("History End Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
}
