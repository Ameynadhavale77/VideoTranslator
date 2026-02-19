import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'edge';

// Types for OpenAI Response
interface OpenAIResponse {
    choices: {
        message: {
            content: string;
        };
    }[];
}

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

        const { sessionId, token } = await req.json();

        if (!token || !sessionId) {
            return NextResponse.json({ error: "Missing Token/Session" }, { status: 401, headers: corsHeaders });
        }

        const admin = getSupabaseAdmin();
        const { data: { user }, error: authError } = await admin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
        }

        // 1. Mark Session as Completed
        await admin
            .from('sessions')
            .update({
                status: 'completed',
                ended_at: new Date().toISOString()
            })
            .eq('id', sessionId);

        console.log(`Session ${sessionId} marked as completed.`);

        // 2. AI Summary Generation (Optional, IF Key exists)
        const openaiKey = process.env.OPENAI_API_KEY;
        if (openaiKey) {
            // Fetch Transcripts
            const { data: transcripts } = await admin
                .from('session_transcripts')
                .select('speaker, text, timestamp')
                .eq('session_id', sessionId)
                .order('timestamp', { ascending: true });

            if (transcripts && transcripts.length > 0) {
                // Prepare Context
                const fullText = transcripts.map(t => `${t.speaker}: ${t.text}`).join('\n');

                // Truncate if too long (Basic safety)
                const truncatedText = fullText.substring(0, 15000); // ~4k tokens approximation safety

                const prompt = `
You are an expert Meeting Assistant. Analyze the following transcript and provide:
1. A concise "Meeting Summary" (3-5 sentences).
2. A list of "Action Items" (Task + Owner). Return these as a JSON array of objects [{ task: string, owner: string }].

Transcript:
${truncatedText}

Return JSON format: { "summary": string, "action_items": [] }
`;

                const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${openaiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini', // or gpt-3.5-turbo
                        messages: [{ role: 'user', content: prompt }],
                        response_format: { type: "json_object" }
                    })
                });

                if (aiResponse.ok) {
                    const aiData = await aiResponse.json() as OpenAIResponse;
                    const content = aiData.choices[0].message.content;
                    if (content) {
                        const result = JSON.parse(content);

                        // Update Session with Summary
                        await admin
                            .from('sessions')
                            .update({
                                ai_summary: result.summary,
                                action_items: result.action_items
                            })
                            .eq('id', sessionId);

                        console.log("AI Summary Generated & Saved.");
                    }
                } else {
                    console.warn("OpenAI API Failed:", await aiResponse.text());
                }
            }
        }

        return NextResponse.json({ success: true }, { headers: corsHeaders });

    } catch (error: any) {
        console.error("End History Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
}
