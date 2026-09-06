import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  RefreshCw,
  Trash2,
  Check,
  Copy,
  Bot,
  User,
  CheckCheck,
  Mic,
  Paperclip,
  ImageIcon,
  X,
  AlertCircle,
} from 'lucide-react';
import { ChatMessage, ImageMetadata } from '../types';
import { sendChatMessage } from '../lib/api';
import { saveInteraction } from '../lib/firestoreService';
import { MarkdownView } from './MarkdownView';
import {
  formatGeminiReflectionForJournal,
  formatImageAnalysisForJournal,
} from '../lib/textFormatter';
import { VoiceChatModal } from './VoiceChatModal';

interface GeminiCompanionProps {
  userId: string;
  activeJournalContent: string;
  activeJournalTitle: string;
  journalId?: string;
  onAppendToJournal: (text: string) => void;
}

interface AttachedImageState {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
  name: string;
  size: number;
}

const QUICK_PROMPTS = [
  '🌱 Help me reflect deeper on this',
  '💡 What perspective might I be missing?',
  '🎯 What is a clear actionable takeaway?',
  '🕊️ How can I gently reframe this situation?',
];

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

export const GeminiCompanion: React.FC<GeminiCompanionProps> = ({
  userId,
  activeJournalContent,
  activeJournalTitle,
  journalId,
  onAppendToJournal,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "I am your Gemini reflection partner. As you write, I'm here to listen, illuminate subtle patterns, analyze personal sketches or photos, and offer thoughtful inquiries. What would you like to explore today?",
      timestamp: Date.now(),
      modelUsed: 'gemini-3.8-flash',
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<AttachedImageState | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [insertedId, setInsertedId] = useState<string | null>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const hasValidExt =
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.webp') ||
      lowerName.endsWith('.heic') ||
      lowerName.endsWith('.heif');

    const mimeType = file.type?.toLowerCase() || '';
    const isAllowed = ALLOWED_MIME_TYPES.includes(mimeType) || hasValidExt;

    if (!isAllowed) {
      setImageError(
        `Unsupported file type for "${file.name}". Please upload a JPEG, PNG, WEBP, or HEIC image.`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setImageError(
        `Image "${file.name}" is too large (${sizeMb} MB). Maximum allowed size is 5 MB.`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) {
        setImageError('Unable to read selected image.');
        return;
      }

      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const normalizedMime =
        mimeType === 'image/jpg'
          ? 'image/jpeg'
          : mimeType || (lowerName.endsWith('.png') ? 'image/png' : 'image/jpeg');

      setSelectedImage({
        file,
        previewUrl: result,
        base64: result,
        mimeType: normalizedMime,
        name: sanitizedName,
        size: file.size,
      });
    };

    reader.onerror = () => {
      setImageError('Failed to read image file from device.');
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async (customPrompt?: string, retryImage?: ImageMetadata) => {
    const textInput = (customPrompt !== undefined ? customPrompt : inputPrompt).trim();
    const imageToAttach = retryImage
      ? {
          base64: retryImage.data || retryImage.previewUrl || '',
          mimeType: retryImage.mimeType,
          name: retryImage.name,
          size: retryImage.size || 0,
        }
      : selectedImage;

    // Both text and image are empty
    if (!textInput && !imageToAttach) return;
    if (loading) return;

    const defaultImagePrompt = 'Please analyze what you see in this image and describe three key details or emotions it conveys.';
    const promptText = textInput || (imageToAttach ? defaultImagePrompt : '');

    // Check if retrying last message
    const lastMsg = messages[messages.length - 1];
    const isRetry = lastMsg?.role === 'user' && lastMsg?.text === promptText && !imageToAttach;

    let updatedMessages: ChatMessage[];
    if (isRetry) {
      updatedMessages = messages;
    } else {
      const userMessage: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        text: promptText,
        timestamp: Date.now(),
        type: imageToAttach ? 'image_understanding' : 'conversation',
        image: imageToAttach
          ? {
              previewUrl: imageToAttach.base64,
              data: imageToAttach.base64,
              name: imageToAttach.name,
              mimeType: imageToAttach.mimeType,
              size: imageToAttach.size,
            }
          : undefined,
      };
      updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
    }

    // Reset input composer state
    setInputPrompt('');
    setSelectedImage(null);
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setLoading(true);
    setIsAnalyzingImage(Boolean(imageToAttach));
    setError(null);

    try {
      const response = await sendChatMessage({
        messages: updatedMessages.map((m) => ({
          role: m.role,
          text: m.text,
        })),
        currentJournal: activeJournalContent,
        actionType: imageToAttach ? 'image_understanding' : 'conversation',
        image: imageToAttach
          ? {
              data: imageToAttach.base64,
              mimeType: imageToAttach.mimeType,
              name: imageToAttach.name,
            }
          : undefined,
      });

      const modelMessage: ChatMessage = {
        id: `model_${Date.now()}`,
        role: 'model',
        text: response.reply,
        timestamp: Date.now(),
        modelUsed: response.modelUsed,
        type: imageToAttach ? 'image_understanding' : 'conversation',
      };

      setMessages((prev) => [...prev, modelMessage]);

      // Guaranteed Transaction Verification: persist interaction to Cloud Firestore
      if (userId) {
        await saveInteraction(userId, {
          journalId,
          journalTitle: activeJournalTitle || 'Active Journal Entry',
          prompt: promptText,
          response: response.reply,
          modelUsed: response.modelUsed,
          type: imageToAttach ? 'image_understanding' : 'conversation',
          imageName: imageToAttach ? imageToAttach.name : undefined,
        });
      }
    } catch (err: any) {
      console.error('Gemini companion error:', err);
      setError(err.message || 'Failed to receive a response from Gemini. Please try again.');
    } finally {
      setLoading(false);
      setIsAnalyzingImage(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInsertIntoJournal = (msg: ChatMessage) => {
    // Find preceding user question and attached image
    const msgIdx = messages.findIndex((m) => m.id === msg.id);
    const precedingUserMsg = messages
      .slice(0, msgIdx >= 0 ? msgIdx : undefined)
      .reverse()
      .find((m) => m.role === 'user');

    const userQuestion = precedingUserMsg?.text || '';
    const attachedImage = precedingUserMsg?.image;

    if (msg.type === 'image_understanding' || attachedImage) {
      const formatted = formatImageAnalysisForJournal(
        userQuestion,
        msg.text,
        attachedImage?.name
      );
      onAppendToJournal(formatted);
    } else {
      onAppendToJournal(formatGeminiReflectionForJournal(msg.text));
    }

    setInsertedId(msg.id);
    setTimeout(() => setInsertedId(null), 2500);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        role: 'model',
        text: 'Dialogue history reset. How can I assist with your journaling today?',
        timestamp: Date.now(),
        modelUsed: 'gemini-3.8-flash',
      },
    ]);
    setError(null);
    handleRemoveImage();
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#1F2937] bg-[#11141B] shadow-xl overflow-hidden">
      {/* Companion Header */}
      <div className="flex items-center justify-between border-b border-[#1F2937] px-5 py-3.5 bg-[#0D1016]">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A1E26] border border-[#2D3748] text-[#B5A48B] shadow-2xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold text-[#E2E8F0] tracking-tight">
                Gemini Companion
              </h3>
              <span className="flex h-1.5 w-1.5 rounded-full bg-[#B5A48B]" title="Active & Multimodal Ready" />
            </div>
            <p className="text-[10px] text-[#64748B]">
              Multimodal Visual & Text Dialogue &middot; Contextual Reflection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Voice Chat Trigger */}
          <button
            id="open-voice-chat-btn"
            type="button"
            onClick={() => setIsVoiceModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#B5A48B]/40 bg-[#B5A48B]/10 px-2.5 py-1.5 text-xs font-medium text-[#B5A48B] hover:bg-[#B5A48B]/20 hover:text-white transition-all cursor-pointer shadow-xs active:scale-95"
            title="Start real-time voice conversation with Gemini"
          >
            <Mic className="h-3.5 w-3.5 text-[#B5A48B] animate-pulse" />
            <span>Voice Chat</span>
          </button>

          <button
            type="button"
            onClick={handleClearChat}
            title="Reset conversation"
            className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#1A1E26] hover:text-[#CBD5E1] transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Prompt Pills */}
      <div className="border-b border-[#1F2937] bg-[#0A0C10] px-4 py-2.5">
        <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mb-2">
          Reflective Prompts
        </p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              id={`quick-prompt-${idx}`}
              type="button"
              onClick={() => handleSend(prompt)}
              disabled={loading}
              className="rounded-md border border-[#2D3748] bg-[#1A1E26] px-2.5 py-1 text-[11px] text-[#94A3B8] hover:border-[#B5A48B] hover:text-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer text-left"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Flow */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs bg-[#11141B]">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#1A1E26] border border-[#2D3748] text-[#B5A48B] mt-0.5">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}

              <div
                className={`group relative max-w-[85%] rounded-xl px-4 py-3 shadow-2xs ${
                  isUser
                    ? 'bg-[#1A1E26] border border-[#334155] text-[#E2E8F0] rounded-tr-xs'
                    : 'bg-[#0D1016] border border-[#1F2937] text-[#CBD5E1] rounded-tl-xs font-light'
                }`}
              >
                {/* Visual Attachment Preview for User Message */}
                {isUser && msg.image?.previewUrl && (
                  <div className="mb-2.5 overflow-hidden rounded-lg border border-[#334155] bg-[#0A0C10]">
                    <img
                      src={msg.image.previewUrl}
                      alt={msg.image.name || 'Uploaded photo'}
                      className="max-h-52 w-full object-contain bg-black/60 rounded-t-lg"
                    />
                    <div className="flex items-center justify-between border-t border-[#1F2937] px-2.5 py-1.5 text-[10px] text-[#94A3B8]">
                      <div className="flex items-center gap-1.5 truncate">
                        <ImageIcon className="h-3 w-3 shrink-0 text-[#B5A48B]" />
                        <span className="truncate font-mono">{msg.image.name}</span>
                      </div>
                      {Boolean(msg.image.size) && (
                        <span className="shrink-0 text-[#64748B] ml-2">
                          {(msg.image.size! / 1024).toFixed(0)} KB
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Message Body */}
                {isUser ? (
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                ) : (
                  <MarkdownView content={msg.text} />
                )}

                {/* Model Attribution & Actions */}
                <div
                  className={`mt-2.5 flex items-center justify-between text-[10px] border-t border-[#1F2937]/60 pt-2 ${
                    isUser ? 'text-[#64748B]' : 'text-[#64748B]'
                  }`}
                >
                  <span>
                    {msg.modelUsed ? (
                      <span className="font-mono text-[9px] text-[#B5A48B] bg-[#B5A48B]/10 px-1.5 py-0.5 rounded border border-[#B5A48B]/20">
                        {msg.modelUsed}
                      </span>
                    ) : (
                      <span>You</span>
                    )}
                  </span>

                  <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.text)}
                      title="Copy response"
                      className="p-1 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                    >
                      {copiedId === msg.id ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                    {!isUser && (
                      <button
                        id={`insert-journal-${msg.id}`}
                        type="button"
                        onClick={() => handleInsertIntoJournal(msg)}
                        title="Add reflection to active journal entry"
                        className="text-[10px] text-[#B5A48B] hover:text-white font-medium ml-1 cursor-pointer flex items-center gap-1 transition-colors"
                      >
                        {insertedId === msg.id ? (
                          <>
                            <CheckCheck className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400 font-semibold">Inserted ✓</span>
                          </>
                        ) : (
                          <span>+ Insert into Journal</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {isUser && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#2D3748] text-[#CBD5E1] mt-0.5">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {/* Processing Indicator */}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#94A3B8] animate-fade-in">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1A1E26] text-[#B5A48B]">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#2D3748] bg-[#0D1016] px-3.5 py-2">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#B5A48B]" />
              <span className="font-light">
                {isAnalyzingImage ? 'Analyzing image...' : 'Gemini is synthesizing thoughts...'}
              </span>
            </div>
          </div>
        )}

        {/* Error message inside chat with retry option */}
        {error && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-3.5 text-xs text-red-200 animate-fade-in">
            <p className="font-semibold text-red-300">Unable to complete reflection</p>
            <p className="mt-1 text-red-200/90 leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={() => {
                const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
                if (lastUserMsg) {
                  handleSend(lastUserMsg.text, lastUserMsg.image);
                }
              }}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/25 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry reflection</span>
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-[#1F2937] p-4 bg-[#0D1016]">
        {/* Thumbnail Preview Before Sending */}
        {selectedImage && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-[#334155] bg-[#161B22] p-2 text-xs animate-fade-in">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img
                src={selectedImage.previewUrl}
                alt={selectedImage.name}
                className="h-10 w-10 shrink-0 rounded-md border border-[#2D3748] object-cover bg-black"
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[#E2E8F0]">
                  {selectedImage.name}
                </p>
                <p className="text-[10px] text-[#64748B]">
                  {(selectedImage.size / 1024).toFixed(0)} KB &middot; Ready for visual analysis
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveImage}
              title="Remove image attachment"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#94A3B8] hover:bg-[#21262D] hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Validation Error Banner */}
        {imageError && (
          <div className="mb-3 flex items-center justify-between rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
              <span>{imageError}</span>
            </div>
            <button
              type="button"
              onClick={() => setImageError(null)}
              className="text-red-400 hover:text-red-200 cursor-pointer p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={handleFileSelect}
            className="hidden"
            id="companion-image-file-input"
          />

          {/* Attach Image Button */}
          <button
            id="attach-image-btn"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            title="Attach Image (JPEG, PNG, WEBP, HEIC - max 5MB)"
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all cursor-pointer shrink-0 ${
              selectedImage
                ? 'border-[#B5A48B] bg-[#B5A48B]/20 text-[#B5A48B]'
                : 'border-[#334155] bg-[#1A1E26] text-[#94A3B8] hover:border-[#B5A48B] hover:text-[#E2E8F0]'
            } disabled:opacity-40`}
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <input
            id="chat-input"
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder={
              selectedImage
                ? `Ask Gemini about ${selectedImage.name}...`
                : 'Ask Gemini to reflect or unpack thoughts...'
            }
            disabled={loading}
            className="flex-1 rounded-lg border border-[#334155] bg-[#1A1E26] px-3.5 py-2 text-xs text-[#E2E8F0] placeholder-[#475569] focus:border-[#B5A48B] focus:outline-none"
          />

          <button
            id="send-chat-btn"
            type="submit"
            disabled={loading || (!inputPrompt.trim() && !selectedImage)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#B5A48B] text-[#0A0C10] hover:bg-white transition-colors disabled:opacity-40 cursor-pointer shrink-0 shadow-sm"
            title={selectedImage ? 'Send image and question' : 'Send message'}
          >
            {loading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </form>

        <div className="mt-2 flex items-center justify-between text-[10px] text-[#475569]">
          <span>Multimodal visual & text analysis</span>
          <span>Shift+Enter for newline</span>
        </div>
      </div>

      {/* Real-time Voice Chat Modal */}
      <VoiceChatModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        userId={userId}
        journalId={journalId}
        journalTitle={activeJournalTitle}
        journalContent={activeJournalContent}
        onAppendToJournal={onAppendToJournal}
      />
    </div>
  );
};
