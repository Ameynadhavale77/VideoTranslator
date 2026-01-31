'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';

export default function BillingPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState("");

    // Initialize Supabase Client (Client Side)
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        const checkAuth = async () => {
            const token = searchParams.get('token');
            if (token) {
                // Verify token passed from extension
                const { data: { user }, error } = await supabase.auth.getUser(token);
                if (user && !error) {
                    setUser(user);
                } else {
                    setStatus("Invalid Token. Please login via Extension.");
                }
            } else {
                setStatus("No session found. Please click 'Buy Credits' from the Extension.");
            }
            setLoading(false);
        };
        checkAuth();
    }, [searchParams]);

    const handlePayment = async (plan: 'starter' | 'pro') => {
        if (!user) return;

        setStatus("Creating Order...");

        const price = plan === 'starter' ? 79 : 299; // INR
        const seconds = plan === 'starter' ? 3600 : 18000;

        try {
            // 1. Create Order
            const res = await fetch('/api/payment/order', {
                method: 'POST',
                body: JSON.stringify({ amount: price })
            });
            const order = await res.json();

            if (order.error) throw new Error(order.error);

            // 2. Open Razorpay
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Add this to env.local public
                amount: order.amount,
                currency: order.currency,
                name: "Video Translator",
                description: plan === 'starter' ? "1 Hour Credits" : "5 Hours Credits",
                order_id: order.id,
                handler: async function (response: any) {
                    setStatus("Verifying Payment...");
                    // 3. Verify Payment
                    const verifyRes = await fetch('/api/payment/verify', {
                        method: 'POST',
                        body: JSON.stringify({
                            orderCreationId: order.id,
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpaySignature: response.razorpay_signature,
                            userId: user.id,
                            planSeconds: seconds
                        })
                    });

                    const verifyData = await verifyRes.json();
                    if (verifyData.success) {
                        setStatus(`Success! Added ${seconds}s. New Balance: ${verifyData.newBalance}s`);
                        // Optional: Close window or redirect
                    } else {
                        setStatus("Verification Failed: " + verifyData.error);
                    }
                },
                prefill: {
                    email: user.email,
                },
                theme: {
                    color: "#3399cc",
                },
            };

            const rzp1 = new (window as any).Razorpay(options);
            rzp1.open();

        } catch (err: any) {
            console.error(err);
            setStatus("Error: " + err.message);
        }
    };

    if (loading) return <div className="p-10 text-white">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-900 text-white p-10 font-sans">
            <Script src="https://checkout.razorpay.com/v1/checkout.js" />

            <h1 className="text-3xl font-bold mb-2">Buy Credits</h1>
            {user && <p className="text-gray-400 mb-8">Logged in as: {user.email}</p>}

            <div className="flex gap-6 flex-wrap">
                {/* Starter Plan */}
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 w-64">
                    <h2 className="text-xl font-bold text-blue-400">Starter</h2>
                    <p className="text-3xl font-bold my-4">₹79</p>
                    <p className="text-gray-400 mb-6">1 Hour Translation Time</p>
                    <button
                        onClick={() => handlePayment('starter')}
                        className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded font-bold"
                    >
                        Buy Now
                    </button>
                </div>

                {/* Pro Plan */}
                <div className="bg-gray-800 p-6 rounded-lg border border-yellow-600 w-64 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-yellow-600 text-xs px-2 py-1">BEST VALUE</div>
                    <h2 className="text-xl font-bold text-yellow-500">Pro</h2>
                    <p className="text-3xl font-bold my-4">₹299</p>
                    <p className="text-gray-400 mb-6">5 Hours Translation Time</p>
                    <button
                        onClick={() => handlePayment('pro')}
                        className="w-full bg-yellow-600 hover:bg-yellow-500 py-2 rounded font-bold text-black"
                    >
                        Buy Now
                    </button>
                </div>
            </div>

            {status && (
                <div className="mt-8 p-4 bg-gray-800 rounded border border-gray-600">
                    Status: {status}
                </div>
            )}
        </div>
    );
}
