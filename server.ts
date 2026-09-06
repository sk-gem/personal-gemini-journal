import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Permissive CORS for iframe preview and reverse-proxy environments
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Top-Level Request Deserialization (Ordering Guarantee)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Resilient Model Fallback Ladder (Ordered by availability & latency per Production Directives)
const MODEL_FALLBACK_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
];

/**
 * Lazy initialization of GoogleGenAI client to prevent startup crashes
 * when GEMINI_API_KEY is not immediately populated.
 */
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing or empty.');
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

/**
 * Helper to execute Gemini generation with the automated fallback ladder and error recovery matrix.
 */
async function generateContentWithFallback(options: {
  contents: any[];
  systemInstruction?: string;
  generationConfig?: any;
}): Promise<{ text: string; modelUsed: string }> {
  const ai = getGenAI();
  let lastError: any = null;

  for (const modelName of MODEL_FALLBACK_LADDER) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: options.contents,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: 0.7,
          ...options.generationConfig,
        },
      });

      const text =
        response?.text ||
        response?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('') ||
        '';

      if (text) {
        return { text, modelUsed: modelName };
      }
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.statusCode || err?.code || '';
      const message = String(err?.message || '');
      console.warn(`[Gemini Fallback] Model ${modelName} failed (${status}: ${message}). Falling back to next candidate...`);
      // Continue to next model in ladder for 503, 429, 404, 500, or network timeouts
    }
  }

  throw new Error(
    `All Gemini fallback models exhausted. Last error: ${lastError?.message || 'Unknown generation failure'}`
  );
}

// Health Check API
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Journal AI Assistant: Interactive Reflection, Chat & Multimodal Image Understanding
app.post('/api/ai/chat', async (req, res) => {
  try {
    // Defensive Payload Ingestion (Null-Safe Destructuring)
    const data = req.body && typeof req.body === 'object' ? req.body : {};
    const messages = Array.isArray(data.messages) ? data.messages : [];
    const currentJournal = typeof data.currentJournal === 'string' ? data.currentJournal : '';
    const actionType = typeof data.actionType === 'string' ? data.actionType : 'conversation';
    const rawImage = data.image && typeof data.image === 'object' ? data.image : null;

    if (messages.length === 0 && !currentJournal && !rawImage) {
      return res.status(400).json({ error: 'At least one message, image, or journal reflection is required.' });
    }

    // Multimodal Image Security Validation & Sanitization
    let imagePart: { inlineData: { mimeType: string; data: string } } | null = null;
    let sanitizedImageName = '';

    if (rawImage) {
      const ALLOWED_MIME_TYPES = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif',
      ];

      const rawMime = typeof rawImage.mimeType === 'string' ? rawImage.mimeType.toLowerCase().trim() : '';
      const normalizedMime = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;

      if (!ALLOWED_MIME_TYPES.includes(rawMime)) {
        return res.status(400).json({
          error: `Unsupported image format (${rawMime || 'unspecified'}). Supported formats are JPEG, PNG, WEBP, and HEIC.`,
        });
      }

      let rawBase64 = typeof rawImage.data === 'string' ? rawImage.data.trim() : '';
      // Strip any data URI scheme prefix (e.g. data:image/png;base64,...)
      rawBase64 = rawBase64.replace(/^data:[^;]+;base64,/, '').trim();

      if (!rawBase64) {
        return res.status(400).json({ error: 'Attached image data is empty.' });
      }

      // Maximum base64 string length (~8MB string corresponds to ~6MB raw binary)
      if (rawBase64.length > 8.5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image exceeds the maximum allowed upload size (5MB).' });
      }

      try {
        const buffer = Buffer.from(rawBase64, 'base64');
        if (buffer.length === 0) {
          return res.status(400).json({ error: 'Failed to decode image data.' });
        }
      } catch {
        return res.status(400).json({ error: 'Malformed base64 image data payload.' });
      }

      sanitizedImageName = typeof rawImage.name === 'string'
        ? path.basename(rawImage.name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
        : 'attached_image.jpg';

      imagePart = {
        inlineData: {
          mimeType: normalizedMime,
          data: rawBase64,
        },
      };
    }

    const hasImage = Boolean(imagePart);
    const systemInstruction = `You are an empathetic, insightful, and supportive personal journaling companion and reflection guide named Gemini Journal Companion.
${hasImage ? 'The user has shared an image with you. Use your native multimodal visual understanding to observe, explore, and reflect deeply on what is visible in the image—its subjects, setting, mood, colors, emotions, and symbolic resonance. Respond with thoughtful, empathetic reflections and follow-up inquiries.' : ''}
Your role is to:
- Actively listen, validate emotional nuances, and gently ask thought-provoking open-ended questions.
- Help the user explore underlying thoughts, feelings, patterns, and personal growth opportunities.
- Offer actionable clarity, constructive reframing, and structured brainstorm points when appropriate.
- Keep tone warm, grounded, non-judgmental, and respectful of personal boundaries.
- Formatting: Use clean markdown with clear paragraphs, bullet points when organizing thoughts, and subtle emphasis.
${currentJournal ? `\nContextual Active Journal Entry being worked on:\n"""\n${currentJournal.slice(0, 4000)}\n"""` : ''}`;

    // Format contents according to @google/genai SDK
    const contents: any[] = [];

    for (const msg of messages) {
      const role = msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user';
      const text = typeof msg.text === 'string' ? msg.text : (typeof msg.content === 'string' ? msg.content : '');
      if (text) {
        contents.push({
          role,
          parts: [{ text }],
        });
      }
    }

    if (contents.length === 0 && currentJournal) {
      contents.push({
        role: 'user',
        parts: [{ text: `Please provide a thoughtful reflection and 2-3 introspective follow-up questions on my journal entry.` }],
      });
    }

    // Attach multimodal imagePart to the active user turn
    if (imagePart) {
      const lastContent = contents[contents.length - 1];
      if (lastContent && lastContent.role === 'user') {
        // Place imagePart alongside the user's question
        lastContent.parts.unshift(imagePart);
      } else {
        contents.push({
          role: 'user',
          parts: [
            imagePart,
            { text: 'Please analyze what you see in this image and share any reflections or observations.' },
          ],
        });
      }
    }

    const result = await generateContentWithFallback({
      contents,
      systemInstruction,
    });

    return res.json({
      reply: result.text,
      modelUsed: result.modelUsed,
      imageName: sanitizedImageName || undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in /api/ai/chat:', error);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred processing your journal reflection.',
    });
  }
});

// Journal AI Summarizer & Mood Analysis
app.post('/api/ai/summarize', async (req, res) => {
  try {
    const data = req.body && typeof req.body === 'object' ? req.body : {};
    const content = typeof data.content === 'string' ? data.content : '';
    const title = typeof data.title === 'string' ? data.title : 'Untitled Entry';

    if (!content.trim()) {
      return res.status(400).json({ error: 'Journal content is required for summarization.' });
    }

    const systemInstruction = `You are an expert mindful journal analyst.
Analyze the provided journal entry and return a structured reflection summary.
Focus on:
1. Executive Summary: 2-3 crisp sentences capturing the core experience or realization.
2. Emotional Tone / Key Themes: Key emotional undercurrents (e.g., gratitude, stress, breakthrough, curiosity).
3. Mindful Takeaway & Gentle Reflection: A deep, encouraging takeaway for personal growth.
4. Next Micro-Step / Actionable Idea: 1-2 low-friction ideas or prompts for tomorrow.

Return formatted, elegant markdown.`;

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `Journal Title: "${title}"\n\nContent:\n${content}`,
          },
        ],
      },
    ];

    const result = await generateContentWithFallback({
      contents,
      systemInstruction,
    });

    return res.json({
      summary: result.text,
      modelUsed: result.modelUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in /api/ai/summarize:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate summary for the journal entry.',
    });
  }
});

// Journal AI Brainstorm & Perspective Reframe
app.post('/api/ai/brainstorm', async (req, res) => {
  try {
    const data = req.body && typeof req.body === 'object' ? req.body : {};
    const topic = typeof data.topic === 'string' ? data.topic : '';
    const currentEntry = typeof data.currentEntry === 'string' ? data.currentEntry : '';

    if (!topic.trim() && !currentEntry.trim()) {
      return res.status(400).json({ error: 'Topic or journal content is required.' });
    }

    const systemInstruction = `You are a creative brainstorming and positive cognitive reframing partner for personal journaling.
Provide 4-5 diverse perspectives, angles, or questions that help broaden the user's view, unlock creative clarity, and spark deeper self-reflection.
Format with clean bullet points and bold conceptual anchors.`;

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `Journal Context:\n${currentEntry}\n\nSpecific Topic / Dilemma to Brainstorm:\n${topic || 'What perspectives or angles might I be missing here?'}`,
          },
        ],
      },
    ];

    const result = await generateContentWithFallback({
      contents,
      systemInstruction,
    });

    return res.json({
      ideas: result.text,
      modelUsed: result.modelUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in /api/ai/brainstorm:', error);
    return res.status(500).json({
      error: error.message || 'Failed to brainstorm perspectives.',
    });
  }
});

// Gemini Live WebSocket Bridge for Real-time Voice Conversations
function setupLiveWebSocketBridge(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/api/live') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
        return;
      }
    } catch (err) {
      console.error('[WebSocket Upgrade Error]:', err);
    }
    socket.destroy();
  });

  wss.on('connection', (clientWs: WebSocket, req: http.IncomingMessage) => {
    let session: any = null;
    let isTerminated = false;

    const cleanup = () => {
      if (isTerminated) return;
      isTerminated = true;
      try {
        if (session) {
          session.close();
          session = null;
        }
      } catch {
        // ignore
      }
      try {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close();
        }
      } catch {
        // ignore
      }
    };

    clientWs.on('close', cleanup);
    clientWs.on('error', (err) => {
      console.error('[Live WebSocket] Client socket error:', err);
      cleanup();
    });

    clientWs.on('message', async (raw) => {
      try {
        const payload = JSON.parse(raw.toString());

        if (payload.type === 'init') {
          try {
            const ai = getGenAI();
            const journalContext = typeof payload.journalContext === 'string' ? payload.journalContext : '';
            const journalTitle = typeof payload.journalTitle === 'string' ? payload.journalTitle : '';

            const systemInstruction = `You are an empathetic, thoughtful voice companion in a mindful journaling app called Personal Gemini Journal.
The user is speaking with you directly in a real-time voice conversation.
Guidelines:
- Keep your spoken responses concise (1 to 3 sentences per turn), warm, reflective, and supportive.
- Speak in natural, human conversational tone.
- Avoid reciting raw Markdown asterisks, numbered headers, or formatted bullet points.
- Actively listen, validate the user's emotional nuance, and pose gentle, curious questions for deeper self-reflection.
${journalContext ? `\nThe user is actively writing a journal reflection titled "${journalTitle || 'Untitled'}":\n"""\n${journalContext.slice(0, 2500)}\n"""` : ''}`;

            session = await ai.live.connect({
              model: 'gemini-3.1-flash-live-preview',
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                },
                systemInstruction: {
                  parts: [{ text: systemInstruction }],
                },
              },
              callbacks: {
                onopen: () => {
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ type: 'ready' }));
                  }
                },
                onmessage: (message: LiveServerMessage) => {
                  if (clientWs.readyState !== WebSocket.OPEN) return;

                  const parts = message.serverContent?.modelTurn?.parts || [];
                  for (const part of parts) {
                    if (part.inlineData?.data) {
                      clientWs.send(
                        JSON.stringify({
                          type: 'audio',
                          audio: part.inlineData.data,
                        })
                      );
                    }
                    if (part.text) {
                      clientWs.send(
                        JSON.stringify({
                          type: 'text',
                          text: part.text,
                        })
                      );
                    }
                    if ((part as any).audioTranscription?.text) {
                      clientWs.send(
                        JSON.stringify({
                          type: 'text',
                          text: (part as any).audioTranscription.text,
                        })
                      );
                    }
                  }

                  // Gemini Live output transcript of spoken audio responses
                  if (message.serverContent?.outputTranscription?.text) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'text',
                        text: message.serverContent.outputTranscription.text,
                      })
                    );
                  }

                  // Gemini Live input transcript of user spoken audio (if provided by Live API)
                  if (message.serverContent?.inputTranscription?.text) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'user_text',
                        text: message.serverContent.inputTranscription.text,
                      })
                    );
                  }

                  if (parts.length === 0 && message.text) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'text',
                        text: message.text,
                      })
                    );
                  }

                  if (message.serverContent?.interrupted) {
                    clientWs.send(JSON.stringify({ type: 'interrupted' }));
                  }

                  if (message.serverContent?.turnComplete) {
                    clientWs.send(JSON.stringify({ type: 'turnComplete' }));
                  }
                },
                onerror: (err: any) => {
                  console.error('[Gemini Live Session Error]:', err);
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'error',
                        message: err?.message || 'Gemini Live voice service encountered an error.',
                      })
                    );
                  }
                },
                onclose: () => {
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ type: 'closed' }));
                  }
                },
              },
            });

            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'ready' }));
            }
          } catch (initErr: any) {
            console.error('[Live WebSocket] Live session initiation error:', initErr);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  message: initErr?.message || 'Failed to establish Gemini Live voice session.',
                })
              );
            }
          }
        } else if (payload.type === 'audio' && payload.audio) {
          if (session) {
            session.sendRealtimeInput({
              audio: { data: payload.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          }
        } else if (payload.type === 'end') {
          cleanup();
        }
      } catch (parseErr) {
        console.warn('[Live WebSocket] Message parse error:', parseErr);
      }
    });
  });
}

// Server Initialization with Vite integration
async function startServer() {
  const server = http.createServer(app);

  // Setup WebSocket Bridge for Gemini Live
  setupLiveWebSocketBridge(server);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Personal Gemini Journal server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
