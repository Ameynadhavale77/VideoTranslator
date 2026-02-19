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

        const { token, title } = await req.json();

        if (!token) {
            return NextResponse.json({ error: "Missing Token" }, { status: 401, headers: corsHeaders });
        }

        // 1. Verify User
        const admin = getSupabaseAdmin();
        const { data: { user }, error: authError } = await admin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
        }

        // 2. Create Session
        // Default title if none provided
        const sessionTitle = title || `Meeting on ${new Date().toLocaleDateString()}`;

        const { data, error } = await admin
            .from('sessions')
            .insert({
                user_id: user.id,
                title: sessionTitle,
                started_at: new Date().toISOString(),
                status: 'live'
            })
            .select()
            .single();

        if (error) {
            console.error("Session Create Error:", error);
            return NextResponse.json({ error: "Failed to create session" }, { status: 500, headers: corsHeaders });
        }

        console.log(`Creating Session for ${user.email}: ${data.id}`);

        return NextResponse.json({ sessionId: data.id }, { headers: corsHeaders });

    } catch (error: any) {
        console.error("Start History Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
}
