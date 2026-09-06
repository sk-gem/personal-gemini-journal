export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export type MoodType = 'peaceful' | 'grateful' | 'thoughtful' | 'energized' | 'stressed' | 'reflective' | 'creative';

export interface VoiceConversationTurn {
  role: 'user' | 'gemini';
  content: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood: MoodType;
  tags: string[];
  summary?: string;
  conversationHistory?: VoiceConversationTurn[];
  voiceSession?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type InteractionType =
  | 'conversation'
  | 'reflection'
  | 'summary'
  | 'brainstorm'
  | 'voice_conversation'
  | 'image_understanding';

export interface VoiceStatus_Type {
  status:
    | 'ready'
    | 'connecting'
    | 'listening'
    | 'speaking'
    | 'disconnected'
    | 'permission_denied'
    | 'error';
}

export type VoiceStatus =
  | 'ready'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'disconnected'
  | 'permission_denied'
  | 'error';

export interface VoiceTranscriptItem {
  id: string;
  sender: 'user' | 'gemini';
  text: string;
  timestamp: number;
}

export interface ImageMetadata {
  previewUrl?: string;
  data?: string; // base64 string
  mimeType: string;
  name: string;
  size?: number;
}

export interface JournalInteraction {
  id: string;
  userId: string;
  journalId?: string;
  journalTitle?: string;
  prompt: string;
  response: string;
  modelUsed: string;
  type: InteractionType;
  imagePreview?: string;
  imageName?: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  modelUsed?: string;
  type?: InteractionType;
  image?: ImageMetadata;
}
