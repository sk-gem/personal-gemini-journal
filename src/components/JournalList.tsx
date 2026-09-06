import React, { useState } from 'react';
import {
  Search,
  BookOpen,
  Calendar,
  Sparkles,
  Trash2,
  ChevronRight,
  PlusCircle,
} from 'lucide-react';
import { JournalEntry, MoodType } from '../types';
import { deleteJournalEntry } from '../lib/firestoreService';
import { createPlainTextSnippet } from '../lib/textFormatter';

interface JournalListProps {
  userId: string;
  entries: JournalEntry[];
  activeEntryId?: string;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
}

export const JournalList: React.FC<JournalListProps> = ({
  userId,
  entries,
  activeEntryId,
  onSelectEntry,
  onNewEntry,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<MoodType | 'all'>('all');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const filteredEntries = entries.filter((entry) => {
    const matchesQuery =
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesMood =
      selectedMoodFilter === 'all' || entry.mood === selectedMoodFilter;

    return matchesQuery && matchesMood;
  });

  const handleDelete = async (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this journal entry?')) {
      return;
    }

    setIsDeletingId(entryId);
    try {
      await deleteJournalEntry(userId, entryId);
    } catch (err) {
      console.error('Failed to delete entry:', err);
      alert('Could not delete entry. Please check your network connection.');
    } finally {
      setIsDeletingId(null);
    }
  };

  const getMoodBadge = (mood: MoodType) => {
    switch (mood) {
      case 'peaceful':
        return { emoji: '🕊️', label: 'Peaceful', color: 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60' };
      case 'grateful':
        return { emoji: '🙏', label: 'Grateful', color: 'bg-amber-950/50 text-amber-300 border-amber-800/60' };
      case 'thoughtful':
        return { emoji: '🤔', label: 'Thoughtful', color: 'bg-indigo-950/50 text-indigo-300 border-indigo-800/60' };
      case 'energized':
        return { emoji: '⚡', label: 'Energized', color: 'bg-orange-950/50 text-orange-300 border-orange-800/60' };
      case 'reflective':
        return { emoji: '🌙', label: 'Reflective', color: 'bg-purple-950/50 text-purple-300 border-purple-800/60' };
      case 'creative':
        return { emoji: '🎨', label: 'Creative', color: 'bg-rose-950/50 text-rose-300 border-rose-800/60' };
      case 'stressed':
        return { emoji: '🌧️', label: 'Stressed', color: 'bg-stone-900 text-stone-400 border-stone-700' };
      default:
        return { emoji: '📝', label: 'Note', color: 'bg-stone-900 text-stone-400 border-stone-700' };
    }
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#1F2937] bg-[#11141B] p-6 shadow-xl">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F2937] pb-4">
        <div>
          <h2 className="text-xl font-serif text-[#E2E8F0]">Recent Reflections</h2>
          <p className="text-xs text-[#64748B]">
            {entries.length} reflections securely preserved in your isolated Firestore subcollection
          </p>
        </div>

        <button
          id="list-new-entry-btn"
          onClick={onNewEntry}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-[#B5A48B] px-4 py-2 text-xs font-bold text-[#0A0C10] hover:bg-white transition-colors cursor-pointer"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          <span>Write New Entry</span>
        </button>
      </div>

      {/* Search & Mood Filter Bar */}
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#64748B]" />
          <input
            id="journal-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reflections by title, content, or #tag..."
            className="w-full rounded-lg border border-[#2D3748] bg-[#1A1E26] pl-8 pr-3 py-2 text-xs text-[#E2E8F0] placeholder-[#475569] focus:border-[#B5A48B] focus:outline-none"
          />
        </div>

        <select
          id="journal-mood-filter"
          value={selectedMoodFilter}
          onChange={(e) => setSelectedMoodFilter(e.target.value as MoodType | 'all')}
          className="rounded-lg border border-[#2D3748] bg-[#1A1E26] px-3 py-2 text-xs text-[#CBD5E1] focus:border-[#B5A48B] focus:outline-none cursor-pointer"
        >
          <option value="all">All Moods</option>
          <option value="peaceful">🕊️ Peaceful</option>
          <option value="grateful">🙏 Grateful</option>
          <option value="thoughtful">🤔 Thoughtful</option>
          <option value="energized">⚡ Energized</option>
          <option value="reflective">🌙 Reflective</option>
          <option value="creative">🎨 Creative</option>
          <option value="stressed">🌧️ Stressed</option>
        </select>
      </div>

      {/* Entries List */}
      <div className="mt-4 flex-1 overflow-y-auto space-y-2.5 pr-1">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1A1E26] border border-[#2D3748] text-[#64748B] mb-3">
              <BookOpen className="h-6 w-6" />
            </div>
            <p className="text-sm font-serif text-[#E2E8F0]">No reflections found</p>
            <p className="mt-1 text-xs text-[#64748B] max-w-sm">
              {searchQuery || selectedMoodFilter !== 'all'
                ? 'Try adjusting your search query or mood filter.'
                : 'Begin your personal journaling sanctuary by recording your first reflection.'}
            </p>
            {!searchQuery && selectedMoodFilter === 'all' && (
              <button
                onClick={onNewEntry}
                className="mt-4 rounded-lg bg-[#B5A48B] px-4 py-2 text-xs font-bold text-[#0A0C10] hover:bg-white transition-colors cursor-pointer"
              >
                Write First Reflection
              </button>
            )}
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const moodInfo = getMoodBadge(entry.mood);
            const isSelected = activeEntryId === entry.id;

            return (
              <div
                key={entry.id}
                onClick={() => onSelectEntry(entry)}
                className={`group relative rounded-xl border p-4 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#B5A48B] bg-[#1A1E26] ring-1 ring-[#B5A48B]'
                    : 'border-[#2D3748] bg-[#1A1E26]/80 hover:bg-[#1A1E26] hover:border-[#334155]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-[#B5A48B]' : 'bg-[#64748B]'}`} />
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium ${moodInfo.color}`}
                      >
                        <span>{moodInfo.emoji}</span>
                        <span>{moodInfo.label}</span>
                      </span>

                      <span className="flex items-center gap-1 text-[11px] text-[#64748B]">
                        <Calendar className="h-3 w-3" />
                        {new Date(entry.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>

                      {entry.summary && (
                        <span className="flex items-center gap-1 rounded bg-[#B5A48B]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#B5A48B] border border-[#B5A48B]/20">
                          <Sparkles className="h-2.5 w-2.5" />
                          Synthesized
                        </span>
                      )}
                    </div>

                    <h3 className="mt-2 text-base font-serif text-[#E2E8F0] group-hover:text-[#B5A48B] transition-colors">
                      {entry.title || 'Untitled Reflection'}
                    </h3>

                    <p className="mt-1 line-clamp-2 text-xs text-[#94A3B8] font-light leading-relaxed">
                      {createPlainTextSnippet(entry.content) || '(Empty entry)'}
                    </p>

                    {/* Tags */}
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {entry.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded px-1.5 py-0.5 text-[10px] text-[#64748B] bg-[#0A0C10] border border-[#2D3748]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Delete button */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleDelete(e, entry.id)}
                      disabled={isDeletingId === entry.id}
                      title="Delete entry"
                      className="rounded-lg p-1.5 text-[#64748B] hover:bg-red-950/60 hover:text-red-300 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-[#475569] group-hover:text-[#B5A48B] transition-colors" />
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
