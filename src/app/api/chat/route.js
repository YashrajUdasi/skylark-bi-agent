/**
 * Chat API Route
 * 
 * POST /api/chat
 * 
 * Receives user messages, runs the AI reasoning pipeline with
 * function calling, and streams the response back to the client.
 */

import { runReasoningStream } from '@/lib/ai/reasoning';

export const maxDuration = 60; // Allow up to 60s for complex queries

export async function POST(req) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: true, message: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Run reasoning with function calling, then stream the final response
    const stream = await runReasoningStream(messages);

    // Create a readable stream from the OpenAI stream
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (err) {
          console.error('[Chat API] Streaming error:', err);
          controller.enqueue(encoder.encode(`\n\n⚠️ An error occurred: ${err.message}`));
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (err) {
    console.error('[Chat API] Error:', err);

    return Response.json(
      {
        error: true,
        message: err.message || 'Failed to process chat message',
        code: err.code || 'CHAT_ERROR',
      },
      { status: err.statusCode || 500 }
    );
  }
}
