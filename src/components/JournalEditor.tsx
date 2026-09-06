import React, { useState, useEffect } from 'react';
import {
  Save,
  Sparkles,
  Lightbulb,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  Clock,
  Eye,
  PenLine,
} from 'lucide-react';
import { JournalEntry, MoodType } from '../types';
import { saveJournalEntry, saveInteraction } from '../lib/firestoreService';
import { generateSummary } from '../lib/api';
import { BrainstormModal } from './BrainstormModal';
import { ErrorBanner } from './ErrorBanner';
import { MarkdownView } from './MarkdownView';

interface JournalEditorProps {
  userId: string;
  activeEntry: JournalEntry | null;
  onEntrySaved: (entry: JournalEntry) => void;
  onNewEntry: () => void;
  onAppendFromExternal: string | null;
  onClearExternalAppend: () => void;
}

const MOODS: Array<{ type: MoodType; label: string; emoji: string }> = [
  { type: 'peaceful', label: 'Peaceful', emoji: '🕊️' },
  { type: 'grateful', label: 'Grateful', emoji: '🙏' },
  { type: 'thoughtful', label: 'Thoughtful', emoji: '🤔' },
  { type: 'energized', label: 'Energized', emoji: '⚡' },
  { type: 'reflective', label: 'Reflective', emoji: '🌙' },
  { type: 'creative', label: 'Creative', emoji: '🎨' },
  { type: 'stressed', label: 'Stressed', emoji: '🌧️' },
];

export const JournalEditor: React.FC<JournalEditorProps> = ({
  userId,
  activeEntry,
  onEntrySaved,
  onNewEntry,
  onAppendFromExternal,
  onClearExternalAppend,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<MoodType>('reflective');
  const [tags, setTags] = useState<string[]>(['daily']);
  const [newTagInput, setNewTagInput] = useState('');
  const [summary, setSummary] = useState<string | undefined>(undefined);

  const [isSaving, setIsSaving] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'saving' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [isBrainstormOpen, setIsBrainstormOpen] = useState(false);
  const [editorViewMode, setEditorViewMode] = useState<'edit' | 'preview'>('edit');

  // Sync state when activeEntry changes
  useEffect(() => {
    if (activeEntry) {
      setTitle(activeEntry.title);
      setContent(activeEntry.content);
      setMood(activeEntry.mood || 'reflective');
      setTags(activeEntry.tags || []);
      setSummary(activeEntry.summary);
      setSaveStatus('saved');
    } else {
      setTitle('');
      setContent('');
      setMood('reflective');
      setTags(['daily']);
      setSummary(undefined);
      setSaveStatus('idle');
    }
  }, [activeEntry?.id]);

  // Handle appends from Gemini chat or brainstorm modal
  useEffect(() => {
    if (onAppendFromExternal) {
      setContent((prev) => (prev ? `${prev}${onAppendFromExternal}` : onAppendFromExternal.trim()));
      setSaveStatus('idle');
      onClearExternalAppend();
    }
  }, [onAppendFromExternal]);

  // Handle Save to Firestore
  const handleSave = async (): Promise<boolean> => {
    if (!title.trim() && !content.trim()) {
      setSaveError('Please enter a title or write some journal content before saving.');
      return false;
    }

    setIsSaving(true);
    setSaveStatus('saving');
    setSaveError(null);

    try {
      const entryId = await saveJournalEntry(userId, {
        id: activeEntry?.id,
        title: title.trim() || 'Untitled Reflection',
        content,
        mood,
        tags,
        summary,
        createdAt: activeEntry?.createdAt,
      });

      const savedObj: JournalEntry = {
        id: entryId,
        userId,
        title: title.trim() || 'Untitled Reflection',
        content,
        mood,
        tags,
        summary,
        createdAt: activeEntry?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      onEntrySaved(savedObj);
      setSaveStatus('saved');
      return true;
    } catch (err: any) {
      console.error('Save to Firestore failed:', err);
      setSaveStatus('error');
      setSaveError(err.message || 'Failed to save to Firestore. Your content is kept safe in the editor.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Summarize with Gemini
  const handleSummarize = async () => {
    if (!content.trim()) {
      setSummaryError('Please write some thoughts in your journal before generating a summary.');
      return;
    }

    setIsSummarizing(true);
    setSummaryError(null);

    try {
      const response = await generateSummary(title || 'Untitled Entry', content);
      setSummary(response.summary);

      // Auto-save the summary into the journal entry in Firestore
      const entryId = await saveJournalEntry(userId, {
        id: activeEntry?.id,
        title: title.trim() || 'Untitled Reflection',
        content,
        mood,
        tags,
        summary: response.summary,
        createdAt: activeEntry?.createdAt,
      });

      // Also persist interaction record under /users/{userId}/interactions
      await saveInteraction(userId, {
        journalId: entryId,
        journalTitle: title.trim() || 'Untitled Reflection',
        prompt: 'Summarize core insights and emotional tone of this journal entry',
        response: response.summary,
        modelUsed: response.modelUsed,
        type: 'summary',
      });

      if (activeEntry) {
        onEntrySaved({
          ...activeEntry,
          summary: response.summary,
        });
      }
      setSaveStatus('saved');
    } catch (err: any) {
      console.error('Summary generation error:', err);
      setSummaryError(err.message || 'Failed to generate summary with Gemini.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const clean = newTagInput.trim().replace(/^#/, '');
      if (clean && !tags.includes(clean)) {
        setTags([...tags, clean]);
        setNewTagInput('');
        setSaveStatus('idle');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
    setSaveStatus('idle');
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#1F2937] bg-[#11141B] p-6 shadow-xl">
      {/* Save Error Banner */}
      {saveError && (
        <ErrorBanner
          message={saveError}
          onRetry={handleSave}
          isRetrying={isSaving}
          onDismiss={() => setSaveError(null)}
        />
      )}

      {/* Summary Error Banner */}
      {summaryError && (
        <ErrorBanner
          message={summaryError}
          onRetry={handleSummarize}
          isRetrying={isSummarizing}
          onDismiss={() => setSummaryError(null)}
        />
      )}

      {/* Top Controls: Actions and Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2937] pb-4">
        <div className="flex items-center gap-2.5">
          <button
            id="new-entry-btn"
            onClick={onNewEntry}
            className="flex items-center gap-1.5 rounded-lg border border-[#334155] bg-[#1A1E26] px-3 py-1.5 text-xs font-medium text-[#CBD5E1] hover:text-white hover:border-[#B5A48B] transition-colors cursor-pointer"
          >
            <PlusCircle className="h-3.5 w-3.5 text-[#B5A48B]" />
            <span>New Reflection</span>
          </button>

          {/* Save Status Indicator */}
          <div className="flex items-center text-xs">
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-[#B5A48B] font-medium bg-[#B5A48B]/10 px-2.5 py-0.5 rounded-full border border-[#B5A48B]/25 text-[11px]">
                <CheckCircle2 className="h-3 w-3 text-[#B5A48B]" />
                Saved to Firestore
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-[#94A3B8] font-medium text-[11px]">
                <RefreshCw className="h-3 w-3 animate-spin text-[#B5A48B]" />
                Syncing to database...
              </span>
            )}
            {saveStatus === 'idle' && content.trim() && (
              <span className="text-[#B5A48B] text-[11px] uppercase tracking-wider">Unsaved changes</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="brainstorm-btn"
            onClick={() => setIsBrainstormOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#334155] bg-[#1A1E26] px-3 py-1.5 text-xs font-medium text-[#CBD5E1] hover:text-white hover:border-[#B5A48B] transition-colors cursor-pointer"
            title="Brainstorm perspectives or reframe your thoughts"
          >
            <Lightbulb className="h-3.5 w-3.5 text-[#B5A48B]" />
            <span>Brainstorm</span>
          </button>

          <button
            id="summarize-btn"
            onClick={handleSummarize}
            disabled={isSummarizing || !content.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-[#334155] bg-[#1A1E26] px-3 py-1.5 text-xs font-medium text-[#CBD5E1] hover:text-white hover:border-[#B5A48B] transition-colors disabled:opacity-40 cursor-pointer"
            title="Extract core realizations and themes"
          >
            {isSummarizing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#B5A48B]" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-[#B5A48B]" />
            )}
            <span>{isSummarizing ? 'Synthesizing...' : 'Gemini Synthesis'}</span>
          </button>

          <button
            id="save-journal-btn"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg bg-[#B5A48B] px-4 py-1.5 text-xs font-bold text-[#0A0C10] hover:bg-white transition-all shadow-sm active:scale-98 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#0A0C10]" />
            ) : (
              <Save className="h-3.5 w-3.5 text-[#0A0C10]" />
            )}
            <span>{isSaving ? 'Saving...' : 'Save Entry'}</span>
          </button>
        </div>
      </div>

      {/* Date Eyebrow */}
      <div className="mt-3">
        <p className="text-[10px] text-[#B5A48B] uppercase tracking-[0.2em] font-medium">
          {new Date(activeEntry?.createdAt || Date.now()).toLocaleDateString(undefined, {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Mood Selector Chips */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-[#64748B] font-semibold">Mood:</span>
        <div className="flex flex-wrap gap-1.5">
          {MOODS.map((m) => {
            const isSelected = mood === m.type;
            return (
              <button
                key={m.type}
                id={`mood-chip-${m.type}`}
                type="button"
                onClick={() => {
                  setMood(m.type);
                  setSaveStatus('idle');
                }}
                className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#B5A48B] bg-[#B5A48B]/15 text-white ring-1 ring-[#B5A48B] shadow-2xs font-semibold'
                    : 'border-[#2D3748] bg-[#1A1E26] text-[#94A3B8] hover:text-white hover:border-[#334155]'
                }`}
              >
                <span>{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Journal Title Input */}
      <div className="mt-4">
        <input
          id="journal-title-input"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSaveStatus('idle');
          }}
          placeholder="The architecture of focus..."
          className="w-full text-2xl sm:text-3xl font-serif text-[#E2E8F0] placeholder-[#475569] bg-transparent focus:outline-none focus:ring-0"
        />
      </div>

      {/* Tags Row */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-[#94A3B8] bg-[#1A1E26] border border-[#2D3748]"
          >
            #{tag}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag)}
              className="text-[#64748B] hover:text-white cursor-pointer ml-0.5"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          id="new-tag-input"
          type="text"
          value={newTagInput}
          onChange={(e) => setNewTagInput(e.target.value)}
          onKeyDown={handleAddTag}
          placeholder="+ Add tag (Enter)"
          className="rounded border border-dashed border-[#334155] bg-transparent px-2 py-0.5 text-[10px] text-[#CBD5E1] placeholder-[#475569] focus:outline-none focus:border-[#B5A48B]"
        />
      </div>

      {/* Editor & Preview Mode Switcher */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center rounded-lg bg-[#0A0C10] border border-[#2D3748] p-0.5 text-xs">
          <button
            id="journal-mode-edit"
            type="button"
            onClick={() => setEditorViewMode('edit')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer ${
              editorViewMode === 'edit'
                ? 'bg-[#1A1E26] text-white font-medium border border-[#334155]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <PenLine className="h-3 w-3 text-[#B5A48B]" />
            <span>Write</span>
          </button>
          <button
            id="journal-mode-preview"
            type="button"
            onClick={() => setEditorViewMode('preview')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer ${
              editorViewMode === 'preview'
                ? 'bg-[#1A1E26] text-white font-medium border border-[#334155]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <Eye className="h-3 w-3 text-[#B5A48B]" />
            <span>Formatted Preview</span>
          </button>
        </div>

        <span className="text-[10px] text-[#64748B] hidden sm:inline">
          {editorViewMode === 'edit' ? 'Markdown formatting supported' : 'Rich formatted view'}
        </span>
      </div>

      {/* Main Journal Content Area */}
      <div className="mt-3 flex-1 flex flex-col min-h-[300px]">
        <textarea
          id="journal-content-textarea"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setSaveStatus('idle');
          }}
          placeholder="Today I sat by the window and noticed how the light shifted across the room. It made me think about the structure of my own thoughts... What is on your mind today?"
          className={`h-full min-h-[300px] w-full resize-none rounded-xl border border-[#1F2937] bg-[#0A0C10] p-4 text-sm font-light leading-relaxed text-[#CBD5E1] placeholder-[#475569] focus:border-[#B5A48B] focus:outline-none focus:ring-1 focus:ring-[#B5A48B] ${
            editorViewMode === 'edit' ? 'block' : 'hidden'
          }`}
        />

        {editorViewMode === 'preview' && (
          <div className="h-full min-h-[300px] w-full overflow-y-auto rounded-xl border border-[#1F2937] bg-[#0A0C10] p-5">
            {content.trim() ? (
              <MarkdownView content={content} />
            ) : (
              <p className="italic text-xs text-[#64748B] font-serif">
                No reflection written yet. Switch back to Write mode to begin your reflection.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Gemini AI Synthesis / Summary View if generated */}
      {summary && (
        <div className="mt-4 rounded-xl border border-[#2D3748] bg-[#1A1E26] p-5">
          <div className="flex items-center justify-between mb-3 border-b border-[#2D3748]/60 pb-2">
            <div className="inline-block px-2.5 py-1 rounded bg-[#B5A48B]/10 text-[#B5A48B] text-[10px] uppercase tracking-widest font-semibold border border-[#B5A48B]/20">
              Gemini Synthesis
            </div>
            <span className="text-[10px] text-[#64748B] font-mono">Persisted in Firestore</span>
          </div>
          <div className="pt-1">
            <MarkdownView content={summary} />
          </div>
        </div>
      )}

      {/* Footer Word & Char Counts */}
      <div className="mt-4 flex items-center justify-between border-t border-[#1F2937] pt-3 text-[11px] text-[#64748B]">
        <div className="flex items-center gap-3">
          <span>{wordCount} words</span>
          <span>&middot;</span>
          <span>{charCount} characters</span>
          {activeEntry?.createdAt && (
            <>
              <span>&middot;</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Created {new Date(activeEntry.createdAt).toLocaleDateString()}
              </span>
            </>
          )}
        </div>
        <span className="font-mono text-[10px] text-[#475569] uppercase tracking-wider">
          Isolated Cloud Firestore
        </span>
      </div>

      {/* Brainstorm Modal */}
      <BrainstormModal
        isOpen={isBrainstormOpen}
        onClose={() => setIsBrainstormOpen(false)}
        currentJournalContent={content}
        currentJournalTitle={title}
        journalId={activeEntry?.id}
        userId={userId}
        onAppendToJournal={(appended) => {
          setContent((prev) => (prev ? `${prev}${appended}` : appended));
          setSaveStatus('idle');
        }}
      />
    </div>
  );
};
