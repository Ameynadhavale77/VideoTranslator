'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

// Types
interface Transcript {
    id: string;
    speaker: string;
    text: string;
    timestamp: number;
}

interface Session {
    id: string;
    title: string;
    started_at: string;
    status: string;
    ai_summary?: string;
    action_items?: any; // JSONB
}

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
    // Unwrap params
    const { id } = use(params);

    const [session, setSession] = useState<Session | null>(null);
    const [transcripts, setTranscripts] = useState<Transcript[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const supabase = getSupabaseClient();

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/');
                return;
            }

            // 1. Fetch Session
            // Validate UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(id)) {
                console.error("Invalid Session ID:", id);
                setLoading(false);
                return;
            }

            const { data: sessionData, error: sessionError } = await supabase
                .from('sessions')
                .select('*')
                .eq('id', id)
                .single();

            if (sessionError) {
                console.error("Session Fetch Error:", JSON.stringify(sessionError, null, 2));
                return;
            }
            setSession(sessionData);

            // 2. Fetch Transcripts
            const { data: transcriptData, error: transcriptError } = await supabase
                .from('session_transcripts')
                .select('*')
                .eq('session_id', id)
                .order('timestamp', { ascending: true });

            if (transcriptError) {
                console.error("Transcript Fetch Error:", JSON.stringify(transcriptError, null, 2));
            }

            if (transcriptData) {
                setTranscripts(transcriptData);
            }
            setLoading(false);
        };

        fetchData();
    }, [id, router, supabase]);

    if (loading) return <div className="text-white p-10 font-sans text-center">Loading session...</div>;
    if (!session) return <div className="text-white p-10 font-sans text-center">Session not found.</div>;

    // Helper to format Action Items (JSONB)
    const actionItems = Array.isArray(session.action_items) ? session.action_items : [];

    return (
        <div className="min-h-screen bg-black text-white p-8 font-sans">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8 border-b border-gray-800 pb-4">
                    {/* <button
                        onClick={() => router.push('/dashboard')}
                        className="text-sm text-gray-500 hover:text-white mb-4 block"
                    >
                        ← Back to History
                    </button> */}
                    <h1 className="text-3xl font-bold">{session.title}</h1>
                    <p className="text-gray-400 mt-1">
                        {new Date(session.started_at).toLocaleString()} • {session.status.toUpperCase()}
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Summary & Actions */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Summary Card */}
                        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
                            <h2 className="text-lg font-semibold mb-3 text-blue-400">AI Summary</h2>
                            {session.ai_summary ? (
                                <p className="text-gray-300 text-sm leading-relaxed">
                                    {session.ai_summary}
                                </p>
                            ) : (
                                <p className="text-gray-600 text-sm italic">
                                    No summary generated yet.
                                </p>
                            )}
                        </div>

                        {/* Action Items Card */}
                        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
                            <h2 className="text-lg font-semibold mb-3 text-green-400">Action Items</h2>
                            {actionItems.length > 0 ? (
                                <ul className="space-y-3">
                                    {actionItems.map((item: any, idx: number) => (
                                        <li key={idx} className="flex items-start text-sm">
                                            <span className="mr-2 mt-1 block w-2 h-2 bg-green-500 rounded-full"></span>
                                            <div>
                                                <span className="text-gray-200 block">{item.task}</span>
                                                {item.owner && (
                                                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                                                        Owner: {item.owner}
                                                    </span>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-600 text-sm italic">
                                    No action items found.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Transcript */}
                    <div className="lg:col-span-2">
                        <div className="bg-gray-900/30 p-6 rounded-xl border border-gray-800 min-h-[500px]">
                            <h2 className="text-lg font-semibold mb-6 text-purple-400">Transcript</h2>

                            <div className="space-y-6">
                                {transcripts.length === 0 ? (
                                    <p className="text-gray-500 italic">No transcript data available.</p>
                                ) : (
                                    transcripts.map((t) => (
                                        <div key={t.id} className="flex gap-4">
                                            <div className="w-24 flex-shrink-0 text-right">
                                                <span className={`text-xs font-medium px-2 py-1 rounded ${t.speaker === 'Speaker 0' ? 'bg-blue-900/30 text-blue-300' : 'bg-purple-900/30 text-purple-300'
                                                    }`}>
                                                    {t.speaker}
                                                </span>
                                                <span className="block text-[10px] text-gray-600 mt-1">
                                                    {new Date(t.timestamp * 1000).toISOString().substr(14, 5)}
                                                </span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-gray-300 leading-relaxed text-sm">
                                                    {t.text}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
