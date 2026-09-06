import React from 'react';
import { Sparkles, BookOpen, LogOut, ShieldCheck, History, MessageSquareText, PenTool } from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile;
  activeTab: 'write' | 'history' | 'interactions';
  setActiveTab: (tab: 'write' | 'history' | 'interactions') => void;
  onLogout: () => void;
  isLoggingOut: boolean;
  entriesCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onLogout,
  isLoggingOut,
  entriesCount,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-[#1F2937] bg-[#0D1016]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand & App Title */}
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1A1E26] border border-[#2D3748] text-[#B5A48B] shadow-sm">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-serif italic tracking-tight text-[#B5A48B]">
                Gemini Journal
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#B5A48B]/10 px-2 py-0.5 text-[11px] font-medium text-[#B5A48B] border border-[#B5A48B]/25">
                <ShieldCheck className="h-3 w-3" />
                Isolated & Encrypted
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] hidden sm:block tracking-wide">
              Private journal reflections powered by server-side Gemini AI
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center rounded-lg bg-[#11141B] border border-[#1F2937] p-1 text-xs font-medium text-[#94A3B8]">
          <button
            id="nav-tab-write"
            onClick={() => setActiveTab('write')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all cursor-pointer ${
              activeTab === 'write'
                ? 'bg-[#1A1E26] text-white border border-[#334155] shadow-xs font-semibold'
                : 'hover:text-white hover:bg-[#1A1E26]/50'
            }`}
          >
            <PenTool className="h-3.5 w-3.5 text-[#B5A48B]" />
            <span>Journal</span>
          </button>
          <button
            id="nav-tab-history"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#1A1E26] text-white border border-[#334155] shadow-xs font-semibold'
                : 'hover:text-white hover:bg-[#1A1E26]/50'
            }`}
          >
            <History className="h-3.5 w-3.5 text-[#B5A48B]" />
            <span>Past Entries</span>
            {entriesCount > 0 && (
              <span className="ml-1 rounded-full bg-[#2D3748] px-1.5 py-0.2 text-[10px] text-[#E2E8F0]">
                {entriesCount}
              </span>
            )}
          </button>
          <button
            id="nav-tab-interactions"
            onClick={() => setActiveTab('interactions')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all cursor-pointer ${
              activeTab === 'interactions'
                ? 'bg-[#1A1E26] text-white border border-[#334155] shadow-xs font-semibold'
                : 'hover:text-white hover:bg-[#1A1E26]/50'
            }`}
          >
            <MessageSquareText className="h-3.5 w-3.5 text-[#B5A48B]" />
            <span>AI Archive</span>
          </button>
        </nav>

        {/* User Profile & Logout */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2.5 text-right hidden md:flex">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="h-8 w-8 rounded-full border border-[#334155] object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#B5A48B] text-[#0A0C10] text-xs font-bold shadow-2xs">
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="text-left">
              <p className="text-xs font-semibold text-[#E2E8F0] leading-tight truncate max-w-[120px]">
                {user.displayName || 'Journaler'}
              </p>
              <p className="text-[10px] text-[#64748B] truncate max-w-[120px]">
                {user.email || 'Signed in'}
              </p>
            </div>
          </div>

          <button
            id="logout-btn"
            onClick={onLogout}
            disabled={isLoggingOut}
            title="Sign out of your account"
            className="flex items-center gap-1.5 rounded-lg border border-[#334155] bg-[#11141B] px-3 py-1.5 text-xs uppercase tracking-widest text-[#94A3B8] shadow-2xs hover:text-white hover:border-[#94A3B8] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5 text-[#64748B]" />
            <span className="hidden sm:inline font-medium">
              {isLoggingOut ? 'Signing out...' : 'Sign Out'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
