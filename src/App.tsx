import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser } from './lib/firebase';
import { subscribeJournalEntries, subscribeInteractions } from './lib/firestoreService';
import { UserProfile, JournalEntry, JournalInteraction } from './types';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { JournalEditor } from './components/JournalEditor';
import { GeminiCompanion } from './components/GeminiCompanion';
import { JournalList } from './components/JournalList';
import { InteractionsHistory } from './components/InteractionsHistory';
import { ErrorBanner } from './components/ErrorBanner';
import { BookOpen, RefreshCw } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'write' | 'history' | 'interactions'>('write');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [interactions, setInteractions] = useState<JournalInteraction[]>([]);
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null);
  const [externalAppend, setExternalAppend] = useState<string | null>(null);

  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Monitor Firebase Authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        });
      } else {
        setUser(null);
        setEntries([]);
        setInteractions([]);
        setActiveEntry(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to user-isolated Cloud Firestore collections
  useEffect(() => {
    if (!user) return;

    const unsubEntries = subscribeJournalEntries(
      user.uid,
      (loadedEntries) => {
        setEntries(loadedEntries);
        setFirestoreError(null);
      },
      (err) => {
        console.error('Firestore entries error:', err);
        setFirestoreError('Unable to sync entries from Cloud Firestore. Please check your network.');
      }
    );

    const unsubInteractions = subscribeInteractions(
      user.uid,
      (loadedInteractions) => {
        setInteractions(loadedInteractions);
      },
      (err) => {
        console.error('Firestore interactions error:', err);
      }
    );

    return () => {
      unsubEntries();
      unsubInteractions();
    };
  }, [user?.uid]);

  // Handle Google Sign-In
  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setAuthError(err.message || 'Failed to sign in with Google.');
    } finally {
      setIsSigningIn(false);
    }
  };

  // Handle Sign-Out
  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await signOutUser();
      setActiveTab('write');
    } catch (err: any) {
      console.error('Sign-out error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // When user selects an entry to open in the editor
  const handleSelectEntry = (entry: JournalEntry) => {
    setActiveEntry(entry);
    setActiveTab('write');
  };

  // Start fresh reflection
  const handleNewEntry = () => {
    setActiveEntry(null);
    setActiveTab('write');
  };

  // When an entry is saved or updated
  const handleEntrySaved = (saved: JournalEntry) => {
    setActiveEntry(saved);
  };

  // Initial Auth Loading Screen
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0C10] text-[#E2E8F0]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1A1E26] border border-[#2D3748] text-[#B5A48B] shadow-lg">
            <BookOpen className="h-6 w-6" />
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#94A3B8]">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#B5A48B]" />
            <span>Verifying session security...</span>
          </div>
        </div>
      </div>
    );
  }

  // If not authenticated, display Landing Page with Google Sign-In
  if (!user) {
    return (
      <LandingPage
        onSignIn={handleSignIn}
        isSigningIn={isSigningIn}
        error={authError}
        onClearError={() => setAuthError(null)}
      />
    );
  }

  // Authenticated Private Dashboard
  return (
    <div className="min-h-screen bg-[#0A0C10] text-[#E2E8F0] flex flex-col font-sans selection:bg-[#B5A48B]/30 selection:text-white">
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleSignOut}
        isLoggingOut={isLoggingOut}
        entriesCount={entries.length}
      />

      <main className="mx-auto flex-1 w-full max-w-7xl p-4 sm:p-6 flex flex-col">
        {firestoreError && (
          <ErrorBanner
            message={firestoreError}
            onDismiss={() => setFirestoreError(null)}
          />
        )}

        {/* Tab 1: Write Journal & Gemini Reflection Companion */}
        {activeTab === 'write' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-stretch">
            {/* Journal Editor: 7 Cols on desktop */}
            <div className="lg:col-span-7 flex flex-col">
              <JournalEditor
                userId={user.uid}
                activeEntry={activeEntry}
                onEntrySaved={handleEntrySaved}
                onNewEntry={handleNewEntry}
                onAppendFromExternal={externalAppend}
                onClearExternalAppend={() => setExternalAppend(null)}
              />
            </div>

            {/* Gemini Reflection Companion: 5 Cols on desktop */}
            <div className="lg:col-span-5 flex flex-col h-full min-h-[520px]">
              <GeminiCompanion
                userId={user.uid}
                activeJournalContent={activeEntry?.content || ''}
                activeJournalTitle={activeEntry?.title || ''}
                journalId={activeEntry?.id}
                onAppendToJournal={(text) => setExternalAppend(text)}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Previous Journal Entries Archive */}
        {activeTab === 'history' && (
          <div className="flex-1 flex flex-col">
            <JournalList
              userId={user.uid}
              entries={entries}
              activeEntryId={activeEntry?.id}
              onSelectEntry={handleSelectEntry}
              onNewEntry={handleNewEntry}
            />
          </div>
        )}

        {/* Tab 3: AI Archive / Past Gemini Dialogues */}
        {activeTab === 'interactions' && (
          <div className="flex-1 flex flex-col">
            <InteractionsHistory
              userId={user.uid}
              interactions={interactions}
              onOpenJournal={(jId) => {
                const found = entries.find((e) => e.id === jId);
                if (found) handleSelectEntry(found);
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
