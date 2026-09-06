import React, { useState } from 'react';
import { Sparkles, X, Lightbulb, Copy, Check, ArrowRight, RefreshCw } from 'lucide-react';
import { generateBrainstorm } from '../lib/api';
import { saveInteraction } from '../lib/firestoreService';
import { MarkdownView } from './MarkdownView';
import { formatGeminiBrainstormForJournal } from '../lib/textFormatter';

interface BrainstormModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentJournalContent: string;
  currentJournalTitle: string;
  journalId?: string;
  userId: string;
  onAppendToJournal: (text: string) => void;
}

export const BrainstormModal: React.FC<BrainstormModalProps> = ({
  isOpen,
  onClose,
  currentJournalContent,
  currentJournalTitle,
  journalId,
  userId,
  onAppendToJournal,
}) => {
  const [topic, setTopic] = useState('');
  const [ideas, setIdeas] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!topic.trim() && !currentJournalContent.trim()) {
      setError('Please provide a topic or write some journal content to brainstorm from.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await generateBrainstorm(topic, currentJournalContent);
      setIdeas(response.ideas);
      setModelUsed(response.modelUsed);

      // Guaranteed Transaction Verification: persist interaction to Firestore
      if (userId) {
        await saveInteraction(userId, {
          journalId,
          journalTitle: currentJournalTitle || 'Active Journal Entry',
          prompt: topic || 'Brainstorm creative perspectives and cognitive reframings',
          response: response.ideas,
          modelUsed: response.modelUsed,
          type: 'brainstorm',
        });
      }
    } catch (err: any) {
      console.error('Brainstorm error:', err);
      setError(err.message || 'Failed to brainstorm perspectives. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!ideas) return;
    navigator.clipboard.writeText(ideas);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAppend = () => {
    if (!ideas) return;
    onAppendToJournal(formatGeminiBrainstormForJournal(ideas));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl border border-[#1F2937] bg-[#11141B] p-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1F2937] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A1E26] border border-[#2D3748] text-[#B5A48B]">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-serif text-[#E2E8F0]">
                Brainstorm & Cognitive Reframing
              </h3>
              <p className="text-xs text-[#64748B]">
                Discover unexamined angles and positive reframing with Gemini
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#64748B] hover:bg-[#1A1E26] hover:text-[#CBD5E1] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Input Form */}
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
              Specific Angle or Question (Optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., How can I view this obstacle as an opportunity? or What am I avoiding?"
              className="mt-1.5 w-full rounded-lg border border-[#334155] bg-[#1A1E26] px-3.5 py-2.5 text-xs text-[#E2E8F0] placeholder-[#475569] focus:border-[#B5A48B] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-[#64748B]">
              {currentJournalContent.trim()
                ? `Analyzing active reflection (${currentJournalContent.trim().split(/\s+/).length} words)`
                : 'Enter a topic prompt above'}
            </span>
            <button
              id="generate-brainstorm-btn"
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-[#B5A48B] px-4 py-2 text-xs font-bold text-[#0A0C10] hover:bg-white transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#0A0C10]" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-[#0A0C10]" />
                  <span>Generate Perspectives</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/40 p-2.5 text-xs text-red-200">
            {error}
          </div>
        )}

        {/* Brainstorm Result */}
        {ideas && (
          <div className="mt-4 max-h-[300px] overflow-y-auto rounded-xl border border-[#1F2937] bg-[#0A0C10] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono text-[#B5A48B]">
                Generated via {modelUsed || 'Gemini'} &middot; Auto-saved to Firestore
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-[#64748B] hover:text-white font-medium cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
            <div className="p-1">
              <MarkdownView content={ideas} />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-5 flex justify-end gap-2 border-t border-[#1F2937] pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[#334155] bg-[#1A1E26] px-4 py-2 text-xs font-medium text-[#CBD5E1] hover:text-white hover:border-[#475569] cursor-pointer"
          >
            Close
          </button>
          {ideas && (
            <button
              onClick={handleAppend}
              className="flex items-center gap-1.5 rounded-lg bg-[#B5A48B] px-4 py-2 text-xs font-bold text-[#0A0C10] hover:bg-white cursor-pointer"
            >
              <span>Add to Active Reflection</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#0A0C10]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
