import React from 'react';

export default function PrivacyPolicy() {
    return (
        <div className="max-w-3xl mx-auto p-8 font-sans">
            <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
            <p className="mb-4 text-sm text-gray-500">Last Updated: February 4, 2026</p>

            <div className="space-y-6">
                <section>
                    <h2 className="text-xl font-semibold mb-2">1. Description of Service</h2>
                    <p>
                        "Any Video Translator" is a Chrome Extension that provides real-time subtitles and translations for audio playing in the browser (e.g., Google Meet, Zoom, YouTube).
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">2. Data Collection and Usage</h2>
                    <p className="mb-2">To provide this service, we process audio data from the active tab.</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Audio Data:</strong> We capture audio using the <code>tabCapture</code> API purely for the purpose of transcription and translation.</li>
                        <li><strong>Processing:</strong> This audio is streamed directly to our transcription provider (Deepgram) via a secure, encrypted connection.</li>
                        <li><strong>No Storage:</strong> We <strong>do not store, record, or save</strong> any audio data or conversations. The audio is processed in real-time and discarded immediately after transcription.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">3. User Accounts</h2>
                    <p className="mb-2">We use Supabase for authentication to manage user accounts and credits. We store:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Email Address (for login and account recovery)</li>
                        <li>Encrypted Password</li>
                        <li>Subscription/Credit Balance</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">4. Third-Party Services</h2>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Deepgram:</strong> Used for speech-to-text processing.</li>
                        <li><strong>Razorpay:</strong> Used for securely processing payments. We do not store credit card details.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">5. Contact</h2>
                    <p>
                        For privacy concerns, please contact us at: <a href="mailto:support@anyvideotranslator.com" className="text-blue-500 underline">support@anyvideotranslator.com</a>
                    </p>
                </section>
            </div>
        </div>
    );
}
