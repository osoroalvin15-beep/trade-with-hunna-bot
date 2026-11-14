export type TChatMessage = { role: 'user' | 'assistant'; content: string };

/** Set AI_CHAT_URL on your host (see docs/ai-chat-backend.md). Empty means the chat is not connected. */
export const AI_CHAT_URL: string = process.env.AI_CHAT_URL || '';

const TIMEOUT_MS = 30000;

export const askAssistant = async (messages: TChatMessage[], context: string): Promise<string> => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(AI_CHAT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: messages.slice(-10), context }),
            signal: controller.signal,
        });
        if (!res.ok) throw new Error('The assistant is busy. Please try again in a moment.');
        const data = await res.json();
        if (typeof data?.reply !== 'string' || !data.reply.trim()) throw new Error('The assistant sent no answer.');
        return data.reply;
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            throw new Error('The assistant took too long. Please try again.');
        }
        throw err instanceof Error ? err : new Error('Could not reach the assistant.');
    } finally {
        window.clearTimeout(timer);
    }
};
