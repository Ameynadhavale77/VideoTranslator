import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        const { orderCreationId, razorpayPaymentId, razorpaySignature, userId, planSeconds } = await req.json();

        // 1. Verify Signature
        const secret = process.env.RAZORPAY_KEY_SECRET!;
        const generatedSignature = crypto
            .createHmac('sha256', secret)
            .update(orderCreationId + "|" + razorpayPaymentId)
            .digest('hex');

        if (generatedSignature !== razorpaySignature) {
            return NextResponse.json({ error: "Invalid Payment Signature" }, { status: 400 });
        }

        // 2. Payment Verified! Add Credits.
        console.log(`✅ Payment Verified for user ${userId}. Adding ${planSeconds}s.`);

        const admin = getSupabaseAdmin();

        // Fetch current credits
        const { data: current, error: fetchError } = await admin
            .from('credits')
            .select('balance_seconds')
            .eq('user_id', userId)
            .single();

        let newBalance = planSeconds;
        if (current) {
            newBalance += current.balance_seconds;
        }

        const { error: updateError } = await admin
            .from('credits')
            .upsert({
                user_id: userId,
                balance_seconds: newBalance,
                // created_at is default
            })
            .eq('user_id', userId);

        if (updateError) {
            console.error("DB Error:", updateError);
            return NextResponse.json({ error: "Payment received but DB update failed. Contact Support." }, { status: 500 });
        }

        return NextResponse.json({ success: true, newBalance });

    } catch (error: any) {
        console.error("Verification Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
