import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Square,
  PhoneOff,
  RotateCcw,
  Sparkles,
  X,
  Volume2,
  VolumeX,
  Radio,
  BookOpen,
  Bookmark,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { VoiceStatus, VoiceTranscriptItem } from '../types';
import { floatTo16BitPCMBase64, LiveAudioPlayer } from '../lib/voiceAudio';
import { saveInteraction } from '../lib/firestoreService';
import { MarkdownView } from './MarkdownView';

interface VoiceChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  journalId?: string;
  journalTitle?: string;
  journalContent?: string;
  onAppendToJournal: (text: string) => void;
}

export const VoiceChatModal: React.FC<VoiceChatModalProps> = ({
  isOpen,
  onClose,
  userId,
  journalId,
  journalTitle,
  journalContent,
  onAppendToJournal,
}) => {
  const [status, setStatus] = useState<VoiceStatus>('ready');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [micVolume, setMicVolume] = useState<number>(0);
  const [transcript, setTranscript] = useState<VoiceTranscriptItem[]>([]);
  const [currentGeminiTurn, setCurrentGeminiTurn] = useState<string>('');
  const [currentUserTurn, setCurrentUserTurn] = useState<string>('');
  const [isSavedToJournal, setIsSavedToJournal] = useState<boolean>(false);
  const [isSavedToArchive, setIsSavedToArchive] = useState<boolean>(false);
  const [savingArchive, setSavingArchive] = useState<boolean>(false);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<LiveAudioPlayer | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const isMutedRef = useRef<boolean>(false);
  const statusRef = useRef<VoiceStatus>('ready');

  // Keep refs in sync with state for callbacks
  isMutedRef.current = isMuted;
  statusRef.current = status;

  // Cleanup all audio and network resources
  const cleanupResources = () => {
    // 1. Stop SpeechRecognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    // 2. Stop visualizer loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setMicVolume(0);

    // 3. Stop mic stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // 4. Disconnect ScriptProcessor
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch {
        // ignore
      }
      scriptProcessorRef.current = null;
    }

    // 5. Close input AudioContext
    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
      try {
        inputAudioCtxRef.current.close();
      } catch {
        // ignore
      }
      inputAudioCtxRef.current = null;
    }

    // 6. Stop audio player
    if (playerRef.current) {
      playerRef.current.close();
      playerRef.current = null;
    }

    // 7. Close WebSocket
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'end' }));
        }
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
  };

  // Start voice session
  const startSession = async () => {
    cleanupResources();
    setErrorMessage(null);
    setStatus('connecting');
    setCurrentGeminiTurn('');
    setCurrentUserTurn('');

    // Initialize player
    playerRef.current = new LiveAudioPlayer((isSpeaking) => {
      if (statusRef.current !== 'error' && statusRef.current !== 'permission_denied') {
        setStatus(isSpeaking ? 'speaking' : 'listening');
      }
    });

    try {
      // Step 1: Request microphone permission
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;
      } catch (micErr: any) {
        console.warn('Microphone permission request failed:', micErr);
        cleanupResources();
        if (
          micErr.name === 'NotAllowedError' ||
          micErr.name === 'PermissionDeniedError' ||
          micErr.message?.includes('Permission')
        ) {
          setStatus('permission_denied');
        } else {
          setStatus('error');
          setErrorMessage('Could not access microphone: ' + (micErr.message || 'Unknown device error.'));
        }
        return;
      }

      // Step 2: Establish WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live?userId=${encodeURIComponent(userId)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Handshake and journal context
        ws.send(
          JSON.stringify({
            type: 'init',
            userId,
            journalContext: journalContent || '',
            journalTitle: journalTitle || 'Untitled Journal',
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'ready') {
            setStatus('listening');
            startAudioCapture(stream, ws);
            startSpeechRecognition();
          } else if (msg.type === 'audio' && msg.audio) {
            playerRef.current?.playChunk(msg.audio);
          } else if (msg.type === 'text' && msg.text) {
            setCurrentGeminiTurn((prev) => prev + msg.text);
          } else if (msg.type === 'interrupted') {
            playerRef.current?.stopAll();
            setStatus('listening');
          } else if (msg.type === 'turnComplete') {
            setCurrentGeminiTurn((completedText) => {
              if (completedText.trim()) {
                setTranscript((prev) => [
                  ...prev,
                  {
                    id: `gemini_${Date.now()}`,
                    sender: 'gemini',
                    text: completedText.trim(),
                    timestamp: Date.now(),
                  },
                ]);
              }
              return '';
            });
            setStatus('listening');
          } else if (msg.type === 'error') {
            console.error('[Gemini Live WS Server Error]:', msg.message);
            setStatus('error');
            setErrorMessage(msg.message || 'Gemini Live voice error occurred.');
          } else if (msg.type === 'closed') {
            setStatus('disconnected');
          }
        } catch (err) {
          console.error('Error handling WebSocket message:', err);
        }
      };

      ws.onerror = (wsErr) => {
        console.error('WebSocket connection error:', wsErr);
        setStatus('error');
        setErrorMessage('Failed to connect to the Gemini voice server. Please verify your connection and try again.');
      };

      ws.onclose = () => {
        if (statusRef.current !== 'error' && statusRef.current !== 'permission_denied') {
          setStatus('disconnected');
        }
      };
    } catch (err: any) {
      console.error('Failed to start voice session:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Failed to start voice conversation.');
      cleanupResources();
    }
  };

  // Capture mic audio and stream 16kHz PCM
  const startAudioCapture = (stream: MediaStream, ws: WebSocket) => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtxClass({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputCtx;

      const source = inputCtx.createMediaStreamSource(stream);

      // Setup analyser for real-time visualizer
      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;

      // ScriptProcessor for 16-bit PCM chunk streaming
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      // Dummy zero-gain to prevent mic feedback echo
      const silentGain = inputCtx.createGain();
      silentGain.gain.value = 0;

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(inputCtx.destination);

      processor.onaudioprocess = (e) => {
        if (isMutedRef.current) return;
        if (ws.readyState !== WebSocket.OPEN) return;

        const channelData = e.inputBuffer.getChannelData(0);
        const base64Audio = floatTo16BitPCMBase64(channelData);

        ws.send(
          JSON.stringify({
            type: 'audio',
            audio: base64Audio,
          })
        );
      };

      // Visualizer loop
      const updateVolumeMeter = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        setMicVolume(isMutedRef.current ? 0 : Math.min(100, Math.round((average / 128) * 100)));

        animationFrameRef.current = requestAnimationFrame(updateVolumeMeter);
      };
      updateVolumeMeter();
    } catch (err) {
      console.warn('Audio capture setup warning:', err);
    }
  };

  // Browser SpeechRecognition for live user speech transcription (optional enhancement)
  const startSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let finalTrans = '';
        let interimTrans = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTrans += trans;
          } else {
            interimTrans += trans;
          }
        }

        if (finalTrans.trim()) {
          setTranscript((prev) => [
            ...prev,
            {
              id: `user_${Date.now()}`,
              sender: 'user',
              text: finalTrans.trim(),
              timestamp: Date.now(),
            },
          ]);
          setCurrentUserTurn('');
        } else if (interimTrans) {
          setCurrentUserTurn(interimTrans);
        }
      };

      recognition.onerror = (e: any) => {
        // Non-fatal, speech recognition is auxiliary
        console.log('Auxiliary speech recognition notice:', e.error);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.log('Speech recognition not initiated:', err);
    }
  };

  const endSession = () => {
    // Flush current in-progress turns
    if (currentGeminiTurn.trim()) {
      setTranscript((prev) => [
        ...prev,
        {
          id: `gemini_${Date.now()}`,
          sender: 'gemini',
          text: currentGeminiTurn.trim(),
          timestamp: Date.now(),
        },
      ]);
      setCurrentGeminiTurn('');
    }
    if (currentUserTurn.trim()) {
      setTranscript((prev) => [
        ...prev,
        {
          id: `user_${Date.now()}`,
          sender: 'user',
          text: currentUserTurn.trim(),
          timestamp: Date.now(),
        },
      ]);
      setCurrentUserTurn('');
    }

    cleanupResources();
    setStatus('disconnected');
  };

  // Auto-start when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsSavedToJournal(false);
      setIsSavedToArchive(false);
      startSession();
    } else {
      cleanupResources();
      setStatus('ready');
    }
    return () => {
      cleanupResources();
    };
  }, [isOpen]);

  // Insert transcript into active journal
  const handleSaveToJournal = () => {
    if (transcript.length === 0) return;

    let formattedText = '\n\n### 🎙️ Live Voice Reflection Session\n';
    transcript.forEach((t) => {
      const speaker = t.sender === 'user' ? 'You' : 'Gemini';
      formattedText += `\n**${speaker}:** ${t.text}\n`;
    });

    onAppendToJournal(formattedText);
    setIsSavedToJournal(true);
    setTimeout(() => setIsSavedToJournal(false), 3000);
  };

  // Save to Firestore AI Archive
  const handleSaveToArchive = async () => {
    if (!userId || transcript.length === 0 || savingArchive) return;
    setSavingArchive(true);

    try {
      const fullPrompt = transcript
        .filter((t) => t.sender === 'user')
        .map((t) => t.text)
        .join(' | ') || 'Live voice conversation';

      const fullResponse = transcript
        .filter((t) => t.sender === 'gemini')
        .map((t) => t.text)
        .join('\n\n') || 'Spoken dialogue session completed.';

      await saveInteraction(userId, {
        journalId,
        journalTitle: journalTitle || 'Voice Reflection Session',
        prompt: fullPrompt,
        response: fullResponse,
        modelUsed: 'gemini-3.1-flash-live-preview',
        type: 'voice_conversation',
      });

      setIsSavedToArchive(true);
    } catch (err) {
      console.error('Failed to save voice interaction to archive:', err);
    } finally {
      setSavingArchive(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="voice-chat-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in"
    >
      <div className="relative flex h-[90vh] max-h-[700px] w-full max-w-2xl flex-col rounded-2xl border border-[#1F2937] bg-[#0D1016] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1F2937] px-6 py-4 bg-[#11141B]">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1A1E26] border border-[#2D3748] text-[#B5A48B] shadow-inner">
              <Radio className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[#E2E8F0] tracking-tight">
                  Gemini Live Voice Companion
                </h3>
                <span className="rounded bg-[#B5A48B]/10 px-2 py-0.5 text-[9px] font-semibold text-[#B5A48B] border border-[#B5A48B]/20">
                  gemini-3.1-flash-live-preview
                </span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                Real-time, bidirectional spoken dialogue grounded in your journal
              </p>
            </div>
          </div>

          <button
            id="close-voice-modal-btn"
            onClick={onClose}
            className="rounded-lg p-2 text-[#64748B] hover:bg-[#1A1E26] hover:text-white transition-colors cursor-pointer"
            title="Close voice conversation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Central Stage: Status & Audio Visualizer */}
        <div className="flex flex-col items-center justify-center border-b border-[#1F2937] bg-gradient-to-b from-[#11141B] to-[#0A0C10] py-8 px-6 text-center">
          {/* Visual Waveform / Pulsing Orb */}
          <div className="relative mb-4 flex items-center justify-center">
            {/* Outer animated glow ring */}
            <div
              className={`absolute h-28 w-28 rounded-full transition-all duration-300 ${
                status === 'listening'
                  ? 'bg-[#B5A48B]/20 animate-ping'
                  : status === 'speaking'
                  ? 'bg-emerald-500/20 animate-pulse'
                  : status === 'connecting'
                  ? 'bg-amber-500/15 animate-spin'
                  : 'bg-transparent'
              }`}
            />

            {/* Middle decorative ring */}
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-full border transition-all duration-300 ${
                status === 'listening'
                  ? 'border-[#B5A48B] bg-[#1A1E26] shadow-[0_0_20px_rgba(181,164,139,0.3)]'
                  : status === 'speaking'
                  ? 'border-emerald-400 bg-[#0F241A] shadow-[0_0_20px_rgba(52,211,153,0.3)]'
                  : status === 'permission_denied' || status === 'error'
                  ? 'border-rose-500/50 bg-[#2A1215]'
                  : 'border-[#2D3748] bg-[#141820]'
              }`}
            >
              {status === 'listening' ? (
                <Mic className="h-8 w-8 text-[#B5A48B]" />
              ) : status === 'speaking' ? (
                <Volume2 className="h-8 w-8 text-emerald-400 animate-bounce" />
              ) : status === 'connecting' ? (
                <Sparkles className="h-8 w-8 text-amber-300 animate-spin" />
              ) : status === 'permission_denied' ? (
                <AlertCircle className="h-8 w-8 text-rose-400" />
              ) : isMuted ? (
                <MicOff className="h-8 w-8 text-[#64748B]" />
              ) : (
                <Radio className="h-8 w-8 text-[#64748B]" />
              )}
            </div>
          </div>

          {/* Volume bars visual indicator */}
          {status === 'listening' && (
            <div className="mb-3 flex items-center justify-center gap-1.5 h-6">
              {[0.4, 0.7, 1.0, 0.8, 0.5, 0.9, 0.6].map((scale, i) => {
                const barHeight = Math.max(4, Math.min(24, Math.round(micVolume * scale * 0.3)));
                return (
                  <div
                    key={i}
                    style={{ height: `${barHeight}px` }}
                    className="w-1 rounded-full bg-[#B5A48B] transition-all duration-75"
                  />
                );
              })}
            </div>
          )}

          {/* Status Badge & Descriptor */}
          <div className="flex flex-col items-center">
            {status === 'ready' && (
              <span className="text-xs font-medium text-[#94A3B8]">Ready to converse</span>
            )}
            {status === 'connecting' && (
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-medium text-amber-200">
                  Connecting to Gemini Live...
                </span>
              </div>
            )}
            {status === 'listening' && (
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-[#B5A48B] animate-pulse" />
                <span className="text-xs font-medium text-[#E2E8F0]">
                  {isMuted ? 'Microphone Muted' : 'Listening... Speak naturally'}
                </span>
              </div>
            )}
            {status === 'speaking' && (
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-medium text-emerald-300">Gemini is speaking...</span>
              </div>
            )}
            {status === 'disconnected' && (
              <span className="text-xs font-medium text-[#94A3B8]">Conversation concluded</span>
            )}
            {status === 'permission_denied' && (
              <div className="max-w-md rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-center">
                <p className="text-xs font-medium text-rose-300">Microphone Permission Denied</p>
                <p className="mt-1 text-[11px] text-[#94A3B8] leading-relaxed">
                  Microphone access was blocked by your browser. Please click the permissions icon in
                  your browser address bar to allow microphone access, then click Reconnect.
                </p>
              </div>
            )}
            {status === 'error' && (
              <div className="max-w-md rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-center">
                <p className="text-xs font-medium text-rose-300">Connection Interrupted</p>
                <p className="mt-1 text-[11px] text-[#94A3B8]">
                  {errorMessage || 'A temporary voice network error occurred.'}
                </p>
              </div>
            )}
          </div>

          {/* Action Controls Bar */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {(status === 'listening' || status === 'speaking') && (
              <>
                <button
                  id="mute-voice-btn"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    isMuted
                      ? 'border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                      : 'border border-[#2D3748] bg-[#1A1E26] text-[#CBD5E1] hover:bg-[#252B36]'
                  }`}
                >
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
                </button>

                <button
                  id="end-voice-btn"
                  onClick={endSession}
                  className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span>End Conversation</span>
                </button>
              </>
            )}

            {(status === 'disconnected' || status === 'ready' || status === 'error' || status === 'permission_denied') && (
              <button
                id="retry-voice-btn"
                onClick={startSession}
                className="flex items-center gap-2 rounded-xl border border-[#B5A48B] bg-[#B5A48B] px-5 py-2 text-xs font-medium text-[#0D1016] hover:bg-[#C8BAA3] transition-colors cursor-pointer font-semibold shadow-md"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{status === 'disconnected' ? 'Start New Voice Session' : 'Retry Connection'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Conversation Transcript Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#0D1016]/80">
          <div className="flex items-center justify-between border-b border-[#1F2937]/50 pb-2">
            <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
              Conversation Dialogue
            </span>
            <span className="text-[10px] text-[#64748B]">
              {transcript.length} {transcript.length === 1 ? 'turn' : 'turns'} recorded
            </span>
          </div>

          {transcript.length === 0 && !currentGeminiTurn && !currentUserTurn && (
            <div className="flex h-32 flex-col items-center justify-center text-center text-[#64748B]">
              <Radio className="h-6 w-6 text-[#2D3748] mb-2" />
              <p className="text-xs font-light">
                {status === 'listening'
                  ? 'Speak naturally through your microphone. Gemini will listen and reply.'
                  : 'Start a voice session to begin a spoken dialogue.'}
              </p>
            </div>
          )}

          {transcript.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col rounded-xl p-3.5 text-xs transition-all ${
                item.sender === 'user'
                  ? 'ml-8 bg-[#1A1E26] border border-[#2D3748] text-[#E2E8F0]'
                  : 'mr-8 bg-[#11141B] border border-[#1F2937] text-[#CBD5E1]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 text-[10px] text-[#64748B]">
                <span className="font-medium text-[#B5A48B]">
                  {item.sender === 'user' ? 'You' : 'Gemini'}
                </span>
                <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <MarkdownView content={item.text} />
            </div>
          ))}

          {/* Current Live User Turn */}
          {currentUserTurn && (
            <div className="ml-8 rounded-xl p-3.5 text-xs bg-[#1A1E26]/60 border border-[#2D3748]/50 text-[#94A3B8] italic">
              <span className="text-[10px] text-[#B5A48B] block mb-1">You (Speaking...)</span>
              {currentUserTurn}
            </div>
          )}

          {/* Current Live Gemini Turn */}
          {currentGeminiTurn && (
            <div className="mr-8 rounded-xl p-3.5 text-xs bg-[#11141B] border border-emerald-500/30 text-[#CBD5E1]">
              <span className="text-[10px] text-emerald-400 block mb-1 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                Gemini (Speaking...)
              </span>
              <MarkdownView content={currentGeminiTurn} />
            </div>
          )}
        </div>

        {/* Footer Actions: Save to Journal & Archive */}
        <div className="flex flex-wrap items-center justify-between border-t border-[#1F2937] bg-[#11141B] px-6 py-3 gap-3">
          <div className="text-[11px] text-[#64748B]">
            {transcript.length > 0 ? (
              <span>Dialogue available to attach directly into your active reflection.</span>
            ) : (
              <span>Spoken thoughts will appear in the dialogue above.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              id="save-voice-to-journal-btn"
              onClick={handleSaveToJournal}
              disabled={transcript.length === 0}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                transcript.length === 0
                  ? 'opacity-40 cursor-not-allowed text-[#64748B] bg-[#1A1E26]'
                  : isSavedToJournal
                  ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border border-[#B5A48B]/40 bg-[#B5A48B]/10 text-[#B5A48B] hover:bg-[#B5A48B]/20 hover:text-white'
              }`}
            >
              {isSavedToJournal ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <BookOpen className="h-3.5 w-3.5" />}
              <span>{isSavedToJournal ? 'Appended to Journal ✓' : 'Insert into Journal'}</span>
            </button>

            <button
              id="save-voice-to-archive-btn"
              onClick={handleSaveToArchive}
              disabled={transcript.length === 0 || isSavedToArchive || savingArchive}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                transcript.length === 0 || isSavedToArchive
                  ? 'opacity-40 cursor-not-allowed text-[#64748B] bg-[#1A1E26]'
                  : 'border border-[#2D3748] bg-[#1A1E26] text-[#CBD5E1] hover:text-white'
              }`}
            >
              {isSavedToArchive ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Bookmark className="h-3.5 w-3.5" />}
              <span>{isSavedToArchive ? 'Archived ✓' : 'Save to AI Archive'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
