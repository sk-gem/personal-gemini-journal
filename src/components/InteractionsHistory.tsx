import React, { useState } from 'react';
import {
  MessageSquareText,
  Sparkles,
  Lightbulb,
  Copy,
  Check,
  Trash2,
  Bot,
  User,
  ShieldCheck,
  ImageIcon,
} from 'lucide-react';
import { JournalInteraction, InteractionType } from '../types';
import { deleteInteraction } from '../lib/firestoreService';
import { MarkdownView } from './MarkdownView';

interface InteractionsHistoryProps {
  userId: string;
  interactions: JournalInteraction[];
  onOpenJournal?: (journalId: string) => void;
}

export const InteractionsHistory: React.FC<InteractionsHistoryProps> = ({
  userId,
  interactions,
  onOpenJournal,
}) => {
  const [filterType, setFilterType] = useState<InteractionType | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const filteredInteractions = interactions.filter((item) => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (interactionId: string) => {
    if (!window.confirm('Delete this saved AI reflection record from your archive?')) {
      return;
    }

    setIsDeletingId(interactionId);
    try {
      await deleteInteraction(userId, interactionId);
    } catch (err) {
      console.error('Failed to delete interaction:', err);
    } finally {
      setIsDeletingId(null);
    }
  };

  const getTypeBadge = (type: InteractionType) => {
    switch (type) {
      case 'summary':
        return { label: 'Gemini Synthesis', icon: Sparkles, color: 'bg-[#B5A48B]/10 text-[#B5A48B] border-[#B5A48B]/30' };
      case 'brainstorm':
        return { label: 'Brainstorm', icon: Lightbulb, color: 'bg-amber-950/40 text-amber-300 border-amber-800/50' };
      case 'reflection':
        return { label: 'Deep Reflection', icon: MessageSquareText, color: 'bg-purple-950/40 text-purple-300 border-purple-800/50' };
      case 'image_understanding':
        return { label: 'Visual Analysis', icon: ImageIcon, color: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50' };
      default:
        return { label: 'Dialogue', icon: Bot, color: 'bg-[#1A1E26] text-[#94A3B8] border-[#334155]' };
    }
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#1F2937] bg-[#11141B] p-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F2937] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-serif text-[#E2E8F0]">AI Reflections & Archive</h2>
            <span className="flex items-center gap-1 rounded-full bg-[#B5A48B]/10 px-2.5 py-0.5 text-[10px] font-medium text-[#B5A48B] border border-[#B5A48B]/25">
              <ShieldCheck className="h-3 w-3" />
              Isolated in Firestore
            </span>
          </div>
          <p className="text-xs text-[#64748B]">
            Archive of all user inquiries, syntheses, and Gemini dialogues
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(['all', 'conversation', 'image_understanding', 'summary', 'brainstorm'] as const).map((type) => (
            <button
              key={type}
              id={`filter-interaction-${type}`}
              onClick={() => setFilterType(type)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-all cursor-pointer ${
                filterType === type
                  ? 'bg-[#B5A48B] text-[#0A0C10] font-bold shadow-2xs'
                  : 'bg-[#1A1E26] border border-[#2D3748] text-[#94A3B8] hover:text-white hover:border-[#334155]'
              }`}
            >
              {type === 'all' ? 'All Records' : type === 'image_understanding' ? 'Visual Analysis' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Interactions Stream */}
      <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
        {filteredInteractions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1A1E26] border border-[#2D3748] text-[#64748B] mb-3">
              <MessageSquareText className="h-6 w-6" />
            </div>
            <p className="text-sm font-serif text-[#E2E8F0]">No AI interaction records yet</p>
            <p className="mt-1 text-xs text-[#64748B] max-w-sm">
              Use the Gemini reflection companion or click "Gemini Synthesis" on your reflections to record your first dialogue.
            </p>
          </div>
        ) : (
          filteredInteractions.map((item) => {
            const badge = getTypeBadge(item.type);
            const Icon = badge.icon;

            return (
              <div
                key={item.id}
                className="rounded-xl border border-[#2D3748] bg-[#1A1E26] p-5 shadow-2xs hover:border-[#334155] transition-all"
              >
                {/* Meta Bar */}
                <div className="flex items-center justify-between border-b border-[#2D3748] pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badge.color}`}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{badge.label}</span>
                    </span>

                    {item.journalTitle && (
                      <span className="text-[11px] text-[#CBD5E1] truncate max-w-[200px]">
                        Linked to: "{item.journalTitle}"
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
                    <span className="font-mono text-[9px] bg-[#0A0C10] border border-[#2D3748] px-1.5 py-0.5 rounded text-[#B5A48B]">
                      {item.modelUsed || 'gemini-3.6-flash'}
                    </span>
                    <span>
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={isDeletingId === item.id}
                      title="Delete record"
                      className="rounded p-1 text-[#64748B] hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Prompt Section */}
                <div className="flex items-start gap-2.5 mb-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#2D3748] text-[#CBD5E1] text-[10px] mt-0.5">
                    <User className="h-3 w-3" />
                  </div>
                  <div className="flex-1">
                    {item.imageName && (
                      <div className="mb-1.5 inline-flex items-center gap-1.5 rounded bg-[#161B22] border border-[#2D3748] px-2 py-0.5 text-[10px] font-mono text-[#B5A48B]">
                        <ImageIcon className="h-3 w-3" />
                        <span>{item.imageName}</span>
                      </div>
                    )}
                    <p className="text-xs font-semibold text-[#E2E8F0]">{item.prompt}</p>
                  </div>
                </div>

                {/* Response Section */}
                <div className="flex items-start gap-2.5 rounded-lg bg-[#0D1016] p-4 border border-[#1F2937]">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#1A1E26] border border-[#2D3748] text-[#B5A48B] text-[10px] mt-0.5">
                    <Bot className="h-3 w-3" />
                  </div>
                  <div className="flex-1">
                    <MarkdownView content={item.response} />

                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => handleCopy(item.id, item.response)}
                        className="flex items-center gap-1 text-[11px] text-[#64748B] hover:text-white font-medium cursor-pointer"
                      >
                        {copiedId === item.id ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
