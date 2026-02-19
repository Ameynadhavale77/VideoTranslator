'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    // Capture hash immediately before Supabase cleans it
    const initialHash = window.location.hash;

    // 1. Check for Errors in URL (e.g. Link Expired from Email Scanner)
    if (initialHash.includes('error=')) {
      const params = new URLSearchParams(initialHash.substring(1));
      const errorDesc = params.get('error_description')?.replace(/\+/g, ' ');
      setStatus(`❌ Error: ${errorDesc || "Link Expired or Invalid"}`);
      setIsError(true);
      return;
    }

    // 2. Safety Net: Login / Recovery Redirect Logic
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        router.push('/auth/reset');
      } else if (event === "SIGNED_IN") {
        // Only show "Verified" if this was a Confirmation/Signup flow
        if (initialHash.includes('type=signup') || initialHash.includes('type=invite') || initialHash.includes('type=magiclink')) {
          setStatus("🎉 Email Verified! You can now log in to the extension.");
          setIsError(false);
          // Clean the URL
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-blue-500 selection:text-white overflow-x-hidden">

      {/* --- Notification Banner (For Auth Events) --- */}
      {status && (
        <div className={`fixed top-0 left-0 w-full p-4 text-center font-bold z-50 animate-slideDown shadow-xl ${isError ? 'bg-red-600' : 'bg-green-600'}`}>
          {status}
        </div>
      )}

      {/* --- Navbar --- */}
      <nav className="container mx-auto px-6 py-6 flex justify-between items-center max-w-7xl">
        <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-600">
          Any Video Translator
        </div>
        <div className="hidden md:flex gap-8 text-sm font-medium text-slate-300">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          {/* <Link href="/dashboard" className="hover:text-blue-400 transition-colors">History</Link> */}
          <Link href="/billing" className="hover:text-white transition-colors">Billing</Link>
        </div>
        <a
          href="https://chrome.google.com/webstore"
          target="_blank"
          className="bg-white text-slate-900 px-5 py-2 rounded-full font-bold hover:bg-blue-50 transition-colors text-sm"
        >
          Add to Chrome
        </a>
      </nav>

      {/* --- Hero Section --- */}
      <header className="container mx-auto px-6 py-20 text-center max-w-5xl">
        <div className="inline-block px-4 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-blue-400 text-xs font-bold mb-6 tracking-wide uppercase">
          v1.0 Now Available
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight mb-8">
          Understand <span className="text-blue-500">Every Video</span><br /> in Real-Time.
        </h1>
        <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          AI-powered subtitles for Netflix, YouTube, Zoom, and Google Meet.
          Break language barriers instantly with the world's fastest translator extension.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="https://chrome.google.com/webstore"
            target="_blank"
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-lg transition-all shadow-lg shadow-blue-900/20 w-full sm:w-auto"
          >
            Install Extension
          </a>
          <Link
            href="/billing"
            className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-lg transition-all w-full sm:w-auto border border-slate-700"
          >
            Buy Credits
          </Link>
        </div>
      </header>

      {/* --- Features Grid --- */}
      <section id="features" className="py-20 bg-slate-900/50 border-y border-slate-800">
        <div className="container mx-auto px-6 max-w-7xl">
          <h2 className="text-3xl font-bold text-center mb-16">Why use Video Translator?</h2>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { title: "Universal Compatibility", desc: "Works on Netflix, YouTube, Coursera, Zoom, Google Meet, and any other video site.", icon: "🌍" },
              { title: "Real-Time AI", desc: "Powered by deepgram Nova-3. Get lightning fast translations with <300ms latency.", icon: "⚡" },
              { title: "100+ Languages", desc: "Translate from English, Spanish, French, German to your local language instantly.", icon: "🗣️" }
            ].map((feature, i) => (
              <div key={i} className="bg-slate-950 p-8 rounded-2xl border border-slate-800 hover:border-blue-500/50 transition-colors">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- How It Works --- */}
      <section className="py-20 bg-slate-900 border-y border-slate-800">
        <div className="container mx-auto px-6 max-w-7xl">
          <h2 className="text-3xl font-bold text-center mb-16">How it Works</h2>
          <div className="grid md:grid-cols-3 gap-12 text-center relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-blue-900 via-blue-500 to-blue-900 opacity-30"></div>

            {[
              { step: "1", title: "Install Extension", desc: "Add to Chrome in one click. No setup required." },
              { step: "2", title: "Open Any Video", desc: "Go to YouTube, Netflix, or a meeting." },
              { step: "3", title: "Click Translate", desc: "See real-time subtitles instantly." }
            ].map((item, i) => (
              <div key={i} className="relative z-10">
                <div className="w-24 h-24 bg-slate-950 border-4 border-blue-600 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-6 shadow-xl shadow-blue-900/20">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Pricing (Razorpay Compliance) --- */}
      <section id="pricing" className="py-20 container mx-auto px-6 max-w-5xl text-center">
        <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
        <p className="text-slate-400 mb-12">Pay only for what you verify. No hidden subscriptions.</p>

        <div className="grid md:grid-cols-3 gap-8 text-left">

          {/* Free Tier */}
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800">
            <h3 className="text-xl font-bold text-white mb-2">Free Trial</h3>
            <div className="text-4xl font-extrabold text-white mb-4">₹0</div>
            <p className="text-slate-400 text-sm mb-6">Perfect for testing.</p>
            <ul className="space-y-3 mb-8 text-slate-300 text-sm">
              <li className="flex items-center gap-2">✅ 30 Minutes Free</li>
              <li className="flex items-center gap-2">✅ All Languages</li>
            </ul>
            <a href="https://chrome.google.com/webstore" target="_blank" className="block text-center py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors">
              Install & Try
            </a>
          </div>

          {/* Starter Plan */}
          <div className="bg-slate-900 p-8 rounded-3xl border border-blue-900/50 relative overflow-hidden">
            <h3 className="text-xl font-bold text-blue-400 mb-2">Starter</h3>
            <div className="text-4xl font-extrabold text-white mb-4">₹79 <span className="text-lg text-slate-500 font-normal">/ 1 hr</span></div>
            <p className="text-slate-400 text-sm mb-6">For casual viewing.</p>
            <ul className="space-y-3 mb-8 text-slate-300 text-sm">
              <li className="flex items-center gap-2">✅ 60 Minutes Credit</li>
              <li className="flex items-center gap-2">✅ Valid Forever</li>
            </ul>
            <Link href="/billing" className="block text-center py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-colors">
              Buy Credits
            </Link>
          </div>

          {/* Pro Plan */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-8 rounded-3xl border border-yellow-600/50 relative overflow-hidden transform scale-105 shadow-2xl shadow-yellow-900/10">
            <div className="absolute top-0 right-0 p-2 bg-yellow-600 text-[10px] font-bold rounded-bl-xl text-black">BEST VALUE</div>
            <h3 className="text-xl font-bold text-yellow-500 mb-2">Pro Pack</h3>
            <div className="text-4xl font-extrabold text-white mb-4">₹299 <span className="text-lg text-slate-500 font-normal">/ 5 hrs</span></div>
            <p className="text-slate-400 text-sm mb-6">For binge watchers.</p>
            <ul className="space-y-3 mb-8 text-slate-300 text-sm">
              <li className="flex items-center gap-2">✅ 300 Minutes Credit</li>
              <li className="flex items-center gap-2">✅ Save ~25%</li>
              <li className="flex items-center gap-2">✅ Valid Forever</li>
            </ul>
            <Link href="/billing" className="block text-center py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors">
              Get Pro
            </Link>
          </div>

        </div>
        <p className="mt-12 text-xs text-center text-slate-600">
          Secured by Razorpay. 100% Refund Guarantee within 7 days.
        </p>
      </section>

      {/* --- Footer --- */}
      <footer className="bg-slate-950 py-12 border-t border-slate-900 text-sm text-slate-500">
        <div className="container mx-auto px-6 text-center">
          <p className="mb-4">&copy; {new Date().getFullYear()} Any Video Translator. All rights reserved.</p>
          <div className="flex justify-center gap-6">
            <Link href="/privacy" className="hover:text-blue-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-blue-400 transition-colors">Terms of Service</Link>
            <a href="mailto:support@anyvideotranslator.com" className="hover:text-blue-400 transition-colors">Contact Support</a>
          </div>
          <div className="mt-8 text-xs text-slate-700">
            System Operational • Secure Connection • v1.0.5
          </div>
        </div>
      </footer>

    </div>
  );
}
