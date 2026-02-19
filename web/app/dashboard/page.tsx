'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

// Type for Session
interface Session {
    id: string;
    title: string;
    started_at: string;
    status: string;
    ai_summary?: string;
}

function DashboardContent() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = getSupabaseClient();

    useEffect(() => {
        const initializeDashboard = async () => {
            // 1. Check for tokens in URL (Handoff from Extension)
            const accessToken = searchParams.get('access_token');
            const refreshToken = searchParams.get('refresh_token');

            if (accessToken && refreshToken) {
                console.log("Setting session from URL tokens...");
                const { error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                });
                if (error) console.error("Failed to set session:", error);

                // Optional: Clean URL
                window.history.replaceState({}, '', '/dashboard');
            }

            // 2. Check Auth
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.log("No user found, redirecting to home");
                router.push('/');
                return;
            }

            // 3. Fetch Sessions
            const { data, error } = await supabase
                .from('sessions')
                .select('*')
                .eq('user_id', user.id)
                .order('started_at', { ascending: false });

            if (data) {
                setSessions(data);
            }
            setLoading(false);
        };

        initializeDashboard();
    }, [router, supabase, searchParams]);

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                    Meeting History
                </h1>
                <button
                    onClick={() => router.push('/')}
                    className="text-gray-400 hover:text-white"
                >
                    Back to Home
                </button>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500 animate-pulse">Loading history...</div>
            ) : sessions.length === 0 ? (
                <div className="text-center py-20 border border-gray-800 rounded-xl bg-gray-900/50">
                    <p className="text-xl text-gray-400 mb-2">No meetings recorded yet.</p>
                    <p className="text-sm text-gray-600">
                        Use the extension to record your first meeting.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {sessions.map((session) => (
                        <div
                            key={session.id}
                            onClick={() => router.push(`/dashboard/${session.id}`)}
                            className="p-6 rounded-xl border border-gray-800 bg-gray-900/30 hover:bg-gray-800/50 transition cursor-pointer group"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-semibold mb-1 group-hover:text-blue-400 transition">
                                        {session.title || 'Untitled Session'}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {new Date(session.started_at).toLocaleString()}
                                    </p>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-medium ${session.status === 'completed'
                                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                    : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                    }`}>
                                    {session.status.toUpperCase()}
                                </div>
                            </div>
                            {session.ai_summary && (
                                <p className="mt-4 text-gray-400 text-sm line-clamp-2">
                                    {session.ai_summary}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function Dashboard() {
    return (
        <div className="min-h-screen bg-black text-white p-8 font-sans">
            <Suspense fallback={<div>Loading...</div>}>
                <DashboardContent />
            </Suspense>
        </div>
    );
}
