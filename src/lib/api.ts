export interface ChatApiRequest {
  messages: Array<{ role: 'user' | 'model'; text: string }>;
  currentJournal?: string;
  actionType?: 'conversation' | 'reflection' | 'summary' | 'brainstorm' | 'image_understanding';
  image?: {
    data: string;
    mimeType: string;
    name?: string;
  };
}

export interface ChatApiResponse {
  reply: string;
  modelUsed: string;
  timestamp: string;
}

export interface SummarizeApiResponse {
  summary: string;
  modelUsed: string;
  timestamp: string;
}

export interface BrainstormApiResponse {
  ideas: string;
  modelUsed: string;
  timestamp: string;
}

/**
 * Resilient fetch with automatic exponential backoff retry for transient network glitches or server cold-starts.
 */
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        // Exponential backoff: 600ms, 1200ms
        await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      }
    }
  }

  const isFailedToFetch = lastError?.message === 'Failed to fetch' || lastError?.name === 'TypeError';
  throw new Error(
    isFailedToFetch
      ? 'Connection to Gemini server temporarily interrupted. Please click retry to reconnect.'
      : lastError?.message || 'Network request failed'
  );
}

/**
 * Sends a conversation turn or prompt to the Gemini API proxy.
 */
export async function sendChatMessage(payload: ChatApiRequest): Promise<ChatApiResponse> {
  const response = await fetchWithRetry('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Network response was not ok' }));
    throw new Error(errorData.error || `Server returned error (${response.status})`);
  }

  return response.json();
}

/**
 * Requests a structured summary and emotional analysis from Gemini.
 */
export async function generateSummary(title: string, content: string): Promise<SummarizeApiResponse> {
  const response = await fetchWithRetry('/api/ai/summarize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, content }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to summarize journal' }));
    throw new Error(errorData.error || `Server returned error (${response.status})`);
  }

  return response.json();
}

/**
 * Requests creative brainstorming perspectives or cognitive reframing from Gemini.
 */
export async function generateBrainstorm(topic: string, currentEntry: string): Promise<BrainstormApiResponse> {
  const response = await fetchWithRetry('/api/ai/brainstorm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ topic, currentEntry }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to brainstorm perspectives' }));
    throw new Error(errorData.error || `Server returned error (${response.status})`);
  }

  return response.json();
}
