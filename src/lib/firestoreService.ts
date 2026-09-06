import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { db, cleanFirestorePayload } from './firebase';
import { JournalEntry, JournalInteraction } from '../types';

/**
 * Persists a journal entry under the authenticated user's isolated subcollection:
 * Path: /users/{userId}/journals/{journalId}
 */
export async function saveJournalEntry(
  userId: string,
  entry: Partial<JournalEntry> & { id?: string }
): Promise<string> {
  if (!userId) throw new Error('User ID is required to persist journal entry.');

  const now = Date.now();
  const entryId = entry.id || `journal_${now}_${Math.random().toString(36).substring(2, 9)}`;

  const docRef = doc(db, 'users', userId, 'journals', entryId);

  const payload: JournalEntry = {
    id: entryId,
    userId,
    title: entry.title?.trim() || 'Untitled Reflection',
    content: entry.content || '',
    mood: entry.mood || 'reflective',
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    summary: entry.summary,
    conversationHistory: Array.isArray(entry.conversationHistory)
      ? entry.conversationHistory.map((turn) => ({
          role: turn.role,
          content: turn.content,
        }))
      : undefined,
    voiceSession: entry.voiceSession ?? undefined,
    createdAt: entry.createdAt || now,
    updatedAt: now,
  };

  const sanitized = cleanFirestorePayload(payload);
  await setDoc(docRef, sanitized, { merge: true });
  return entryId;
}

/**
 * Permanently removes a journal entry for the authenticated user.
 */
export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) throw new Error('User ID and Entry ID are required.');
  const docRef = doc(db, 'users', userId, 'journals', entryId);
  await deleteDoc(docRef);
}

/**
 * Real-time listener for the user's isolated journal entries.
 */
export function subscribeJournalEntries(
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError: (error: Error) => void
): () => void {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const entriesRef = collection(db, 'users', userId, 'journals');
  const q = query(entriesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: JournalEntry[] = snapshot.docs.map((d) => d.data() as JournalEntry);
      onUpdate(items);
    },
    (err) => {
      console.error('Firestore entries subscription error:', err);
      onError(err);
    }
  );
}

/**
 * Persists an AI reflection or interaction under:
 * Path: /users/{userId}/interactions/{interactionId}
 */
export async function saveInteraction(
  userId: string,
  interaction: Partial<JournalInteraction>
): Promise<string> {
  if (!userId) throw new Error('User ID is required to save interaction.');

  const now = Date.now();
  const interactionId =
    interaction.id || `interaction_${now}_${Math.random().toString(36).substring(2, 9)}`;

  const docRef = doc(db, 'users', userId, 'interactions', interactionId);

  const payload: JournalInteraction = {
    id: interactionId,
    userId,
    journalId: interaction.journalId,
    journalTitle: interaction.journalTitle,
    prompt: interaction.prompt || '',
    response: interaction.response || '',
    modelUsed: interaction.modelUsed || 'gemini-3.6-flash',
    type: interaction.type || 'conversation',
    createdAt: interaction.createdAt || now,
  };

  const sanitized = cleanFirestorePayload(payload);
  await setDoc(docRef, sanitized, { merge: true });
  return interactionId;
}

/**
 * Real-time listener for the user's isolated AI interactions.
 */
export function subscribeInteractions(
  userId: string,
  onUpdate: (interactions: JournalInteraction[]) => void,
  onError: (error: Error) => void
): () => void {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const interactionsRef = collection(db, 'users', userId, 'interactions');
  const q = query(interactionsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: JournalInteraction[] = snapshot.docs.map((d) => d.data() as JournalInteraction);
      onUpdate(items);
    },
    (err) => {
      console.error('Firestore interactions subscription error:', err);
      onError(err);
    }
  );
}

/**
 * Permanently removes an interaction.
 */
export async function deleteInteraction(userId: string, interactionId: string): Promise<void> {
  if (!userId || !interactionId) return;
  const docRef = doc(db, 'users', userId, 'interactions', interactionId);
  await deleteDoc(docRef);
}
