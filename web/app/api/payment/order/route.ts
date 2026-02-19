import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export const runtime = 'nodejs'; // Razorpay SDK needs Node.js runtime, not Edge

// Helper to get Razorpay instance lazily
const getRazorpay = () => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error("Razorpay keys are missing");
    }
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
};

export async function POST(req: Request) {
    try {
        const { amount, currency = "INR" } = await req.json();

        const razorpay = getRazorpay();

        const options = {
            amount: amount * 100, // Razorpay works in subunits (paise), so multiply by 100
            currency: currency,
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);
        return NextResponse.json(order);

    } catch (error: any) {
        console.error("Razorpay Order Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
