/**
 * Text formatting utility to convert Gemini Markdown responses into
 * clean, readable text suitable for direct insertion into personal journal entries.
 */

export function cleanMarkdownForJournal(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // 1. Remove code block backticks (```lang ... ```) keeping contents cleanly
  cleaned = cleaned.replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g, (_match, code) => {
    return code.trim();
  });

  // 2. Remove inline code backticks (`code` -> code)
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // 3. Remove heading markdown markers (### Heading -> Heading)
  cleaned = cleaned.replace(/^[ \t]*#{1,6}[ \t]+([^\n]+)$/gm, '$1');

  // 4. Remove leading blockquote markers (> Quote -> Quote)
  cleaned = cleaned.replace(/^[ \t]*>[ \t]?/gm, '');

  // 5. Convert markdown bold/italic (**bold** / *italic* / __bold__ / _italic_)
  // First bold+italic (***text***)
  cleaned = cleaned.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
  // Double asterisks (**bold**)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  // Double underscore (__bold__)
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  // Single asterisks (*italic*) but avoid touching clean bullets
  cleaned = cleaned.replace(/(?<!^[\s]*)\*([^*\n]+)\*/g, '$1');
  // Single underscore (_italic_)
  cleaned = cleaned.replace(/(?<![\w])_([^_]+)_(?![\w])/g, '$1');

  // 6. Convert bullet lists (* or -) into clean, elegant bullet dots (•)
  cleaned = cleaned.replace(/^[ \t]*[-*][ \t]+([^\n]+)$/gm, '• $1');

  // 7. Clean links [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 8. Normalize spacing: keep paragraph breaks, avoid 3+ consecutive newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Prepares a Gemini reflection message for insertion into the journal
 */
export function formatGeminiReflectionForJournal(geminiText: string): string {
  const cleanBody = cleanMarkdownForJournal(geminiText);
  return `\n\n--- Gemini Reflection ---\n${cleanBody}\n`;
}

/**
 * Prepares a Gemini brainstorm message for insertion into the journal
 */
export function formatGeminiBrainstormForJournal(geminiText: string): string {
  const cleanBody = cleanMarkdownForJournal(geminiText);
  return `\n\n--- Gemini Perspectives & Reframing ---\n${cleanBody}\n`;
}

/**
 * Prepares a Gemini visual analysis response for insertion into the journal.
 * Includes user question, image reference note, and clean Gemini response without raw markdown syntax.
 */
export function formatImageAnalysisForJournal(
  question: string,
  geminiText: string,
  imageName?: string
): string {
  const cleanQuestion = cleanMarkdownForJournal(question) || 'Visual Analysis Inquiry';
  const cleanBody = cleanMarkdownForJournal(geminiText);
  const imageNote = imageName ? ` [Attached Image: ${imageName}]` : ' [Attached Image]';

  return `\n\n--- Visual Reflection & Analysis${imageNote} ---\nQuestion: "${cleanQuestion}"\n\n${cleanBody}\n`;
}

/**
 * Creates a brief clean plain-text snippet for entry list cards
 */
export function createPlainTextSnippet(text: string, maxLength: number = 140): string {
  if (!text) return '';
  const plain = cleanMarkdownForJournal(text).replace(/\s+/g, ' ').trim();
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).trim() + '...';
}

/**
 * Formats a complete voice conversation history into clean, readable Markdown
 * for direct insertion into or creation of a journal entry.
 *
 * Example Output:
 * ### 🎙️ Voice Reflection Session
 *
 * **You:** Hello
 *
 * **Gemini:** Hello! How can I help you reflect today?
 */
export function formatVoiceConversationForJournal(
  conversation: Array<{ role: 'user' | 'gemini'; content: string }>
): string {
  if (!conversation || conversation.length === 0) return '';

  let formatted = '### 🎙️ Voice Reflection Session\n\n';
  conversation.forEach((item) => {
    const speaker = item.role === 'user' ? 'You' : 'Gemini';
    const text = item.content ? item.content.trim() : '';
    if (text) {
      formatted += `**${speaker}:** ${text}\n\n`;
    }
  });

  return formatted.trim();
}

