import React from 'react';

export default function TermsAndConditions() {
    return (
        <div className="max-w-3xl mx-auto p-8 font-sans">
            <h1 className="text-3xl font-bold mb-6">Terms and Conditions</h1>
            <p className="mb-4 text-sm text-gray-500">Last Updated: February 4, 2026</p>

            <div className="space-y-6">
                <section>
                    <h2 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h2>
                    <p>
                        By installing or using the "Any Video Translator" Chrome Extension, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use our service.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">2. Description of Service</h2>
                    <p>
                        We provide AI-powered real-time subtitles and translations for videos playing in your browser. While we strive for high accuracy, AI translation may not always be 100% correct.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">3. User Credits & Payments</h2>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>The service operates on a credit-based system. Credits are purchased securely via Razorpay.</li>
                        <li><strong>Refund Policy:</strong> Due to the digital nature of the service (API costs are incurred immediately), all purchases are final and non-refundable.</li>
                        <li>Credits do not expire as long as your account is active.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">4. Disclaimer of Warranties</h2>
                    <p>
                        The service is provided "as is" without any warranties. We do not guarantee that the service will be uninterrupted, error-free, or meet your specific requirements. We are not responsible for mistranslations or any consequences resulting from them.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">5. Limitation of Liability</h2>
                    <p>
                        To the maximum extent permitted by law, "Any Video Translator" shall not be liable for any indirect, incidental, or consequential damages arising from the use of our service.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">6. Contact</h2>
                    <p>
                        For any questions regarding these terms, please contact us at: <a href="mailto:support@anyvideotranslator.com" className="text-blue-500 underline">support@anyvideotranslator.com</a>
                    </p>
                </section>
            </div>
        </div>
    );
}
