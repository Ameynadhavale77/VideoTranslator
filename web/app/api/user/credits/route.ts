import { NextResponse } from 'next/server';
import { getSupabaseClient, getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'edge';

export async function GET(req: Request) {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (req.method === 'OPTIONS') {
        return NextResponse.json({}, { headers: corsHeaders });
    }

    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json({ error: "Missing Token" }, { status: 400, headers: corsHeaders });
        }

        // 1. Verify Token
        const supabase = getSupabaseClient();
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
        }

        // 2. Get Credits
        const admin = getSupabaseAdmin();
        const { data, error: dbError } = await admin
            .from('credits')
            .select('balance_seconds')
            .eq('user_id', user.id)
            .single();

        if (dbError) {
            // If no record, maybe create one? Or just return 0.
            return NextResponse.json({ balance_seconds: 0 }, { headers: corsHeaders });
        }

        return NextResponse.json({ balance_seconds: data.balance_seconds }, { headers: corsHeaders });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
}
