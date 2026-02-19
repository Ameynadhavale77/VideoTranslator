"use client";

import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // Supabase automatically parses the hash from the URL to restore the session.
        // We just need to check if we have a user.
        const supabase = getSupabaseClient();
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === "PASSWORD_RECOVERY") {
                setMessage("Please set your new password.");
            }
        });
    }, []);

    const handleUpdatePassword = async () => {
        setLoading(true);
        setMessage("");
        setIsError(false);

        try {
            const supabase = getSupabaseClient();
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            setMessage("Password updated successfully! You can now login to the extension.");
            // Optional: Redirect to a "Download Extension" page or Home
            setTimeout(() => router.push('/'), 3000);

        } catch (err: any) {
            setMessage(err.message || "Failed to update password");
            setIsError(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-4 text-white">
            <div className="w-full max-w-md space-y-8 rounded-lg border border-gray-700 bg-gray-800 p-6 shadow-xl">
                <h2 className="text-center text-3xl font-bold tracking-tight text-blue-400">
                    Reset Password
                </h2>

                <p className="text-center text-gray-400 text-sm">
                    Enter your new password below.
                </p>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                            New Password
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={handleUpdatePassword}
                        disabled={loading}
                        className={`flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${loading ? "bg-gray-600 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                            }`}
                    >
                        {loading ? "Updating..." : "Update Password"}
                    </button>

                    {message && (
                        <div className={`text-center text-sm p-2 rounded ${isError ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'}`}>
                            {message}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
