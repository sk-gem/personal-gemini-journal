import React from 'react';
import { BookOpen, ShieldCheck, Sparkles, Lock, RefreshCw, Compass, CheckCircle2 } from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => void;
  isSigningIn: boolean;
  error: string | null;
  onClearError: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  isSigningIn,
  error,
  onClearError,
}) => {
  return (
    <div className="min-h-screen bg-[#0A0C10] text-[#E2E8F0] flex flex-col justify-between selection:bg-[#B5A48B]/30 selection:text-white">
      {/* Top Bar */}
      <header className="border-b border-[#1F2937] bg-[#0D1016]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1A1E26] border border-[#2D3748] text-[#B5A48B] shadow-sm">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xl font-serif italic tracking-tight text-[#B5A48B]">
                Gemini Journal
              </span>
              <span className="block text-[10px] uppercase tracking-widest text-[#64748B] font-medium">
                Isolated Cloud Firestore & Server-Side AI
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#B5A48B]/10 px-3 py-1 text-xs font-medium text-[#B5A48B] border border-[#B5A48B]/25">
              <ShieldCheck className="h-3.5 w-3.5 text-[#B5A48B]" />
              Owner Data Isolation Active
            </span>
          </div>
        </div>
      </header>

      {/* Main Hero Content */}
      <main className="mx-auto flex max-w-5xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        {/* Security / Privacy Pill */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2D3748] bg-[#11141B] px-4 py-1.5 text-xs text-[#94A3B8] shadow-xs">
          <Lock className="h-3.5 w-3.5 text-[#B5A48B]" />
          <span>Zero Client-Side Secrets &middot; Cloud Firestore Owner-Bound Rules</span>
        </div>

        {/* Title */}
        <h1 className="max-w-3xl text-4xl font-serif tracking-tight text-[#E2E8F0] sm:text-5xl sm:leading-[1.15]">
          Your private sanctuary for deep reflection, illuminated by thoughtful{' '}
          <span className="italic text-[#B5A48B]">Gemini AI</span>.
        </h1>

        {/* Subtitle */}
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#94A3B8] sm:text-lg font-light">
          Capture thoughts freely. Explore inner perspectives through multi-turn dialogues with
          Gemini, generate mindful syntheses, and reframe challenges—strictly preserved in your isolated personal database.
        </p>

        {/* Error Alert if any */}
        {error && (
          <div className="mt-6 w-full max-w-md rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-left text-sm text-red-200 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-red-300">Authentication Alert</p>
                <p className="mt-1 text-xs text-red-400">{error}</p>
              </div>
              <button
                onClick={onClearError}
                className="text-xs text-red-400 hover:text-red-200 underline font-medium cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Sign In CTA */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <button
            id="google-signin-btn"
            onClick={onSignIn}
            disabled={isSigningIn}
            className="group relative flex items-center justify-center gap-3 rounded-xl border border-[#334155] bg-[#1A1E26] px-7 py-3.5 text-sm font-medium text-white shadow-sm hover:border-[#B5A48B] hover:bg-[#222834] transition-all active:scale-98 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {isSigningIn ? (
              <RefreshCw className="h-5 w-5 animate-spin text-[#B5A48B]" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{isSigningIn ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>
          <span className="text-xs text-[#64748B]">
            Federated Google Identity &middot; Zero passwords handled in app code
          </span>
        </div>

        {/* Feature Grid */}
        <div className="mt-16 grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3 text-left">
          <div className="rounded-xl border border-[#1F2937] bg-[#11141B] p-6 shadow-2xs hover:border-[#2D3748] transition-colors">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1A1E26] border border-[#2D3748] text-[#B5A48B]">
              <Compass className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-serif text-[#E2E8F0]">Empathetic Inquiry</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#94A3B8]">
              Engage in multi-turn dialogues with an attentive AI companion that helps identify patterns and asks introspective questions.
            </p>
          </div>

          <div className="rounded-xl border border-[#1F2937] bg-[#11141B] p-6 shadow-2xs hover:border-[#2D3748] transition-colors">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1A1E26] border border-[#2D3748] text-[#B5A48B]">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-serif text-[#E2E8F0]">Gemini Synthesis</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#94A3B8]">
              One-click summaries distill your reflections into core insights, emotional currents, and positive next micro-steps.
            </p>
          </div>

          <div className="rounded-xl border border-[#1F2937] bg-[#11141B] p-6 shadow-2xs hover:border-[#2D3748] transition-colors">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1A1E26] border border-[#2D3748] text-[#B5A48B]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-serif text-[#E2E8F0]">Owner Isolation</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#94A3B8]">
              Every entry and conversation is isolated in Firestore using security rules where only your verified UID has read/write permissions.
            </p>
          </div>
        </div>

        {/* Architecture Guarantee Points */}
        <div className="mt-12 flex flex-wrap justify-center gap-6 text-xs text-[#64748B]">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#B5A48B]" /> Server-side API key proxy
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#B5A48B]" /> Multi-model fallback ladder
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#B5A48B]" /> Firestore real-time synchronization
          </span>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1F2937] bg-[#0D1016] py-4 text-center text-xs text-[#64748B]">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Gemini Journal &middot; Sophisticated Dark Architecture</span>
          <span className="font-mono text-[11px] text-[#475569]">
            Google Cloud Run &middot; Cloud Firestore &middot; Gemini
          </span>
        </div>
      </footer>
    </div>
  );
};
