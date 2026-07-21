'use client';

import { useState, useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import styles from './ChatInterface.module.css';

const SUGGESTIONS = [
  "How's our pipeline looking this quarter?",
  "What's the revenue breakdown by sector?",
  "Show me all active work orders",
  "Prepare a leadership update",
  "What's our win rate?",
  "Which sectors are performing best?",
];

/**
 * ChatInterface Component
 * 
 * Full conversational UI for the BI Agent.
 * Sends messages to /api/chat and streams the response.
 * Supports suggestion chips, thinking indicators, and auto-scroll.
 */
export default function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  /**
   * Sends a message to the AI agent.
   */
  async function sendMessage(text) {
    const userMessage = text || input.trim();
    if (!userMessage || isLoading) return;

    // Add user message
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Server error: ${res.status}`);
      }

      // Stream the response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      // Add empty assistant message for streaming
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantMessage += chunk;

        // Update the last message with streamed content
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: assistantMessage,
          };
          return updated;
        });
      }

      // If we got an empty response
      if (!assistantMessage.trim()) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'I wasn\'t able to generate a response. Please try rephrasing your question.',
          };
          return updated;
        });
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ **Error:** ${err.message}\n\nPlease check your API configuration and try again.`,
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleSuggestion(text) {
    sendMessage(text);
  }

  return (
    <div className={styles.chatContainer}>
      {/* Header */}
      <div className={styles.chatHeader}>
        <div className={styles.chatHeaderTitle}>
          <div className={styles.chatOnline} />
          Skylark BI Agent
        </div>
        {messages.length > 0 && (
          <button
            className="btn btn--sm"
            onClick={() => setMessages([])}
            title="Clear chat"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className={styles.chatMessages}>
        {messages.length === 0 ? (
          <div className={styles.chatEmpty}>
            <div className={styles.chatEmptyIcon}>🤖</div>
            <div className={styles.chatEmptyTitle}>Skylark BI Agent</div>
            <div className={styles.chatEmptyDesc}>
              Ask me anything about your deals pipeline, work orders, revenue metrics, or sector performance. I query Monday.com in real-time.
            </div>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  className={styles.suggestion}
                  onClick={() => handleSuggestion(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <ChatMessage key={i} role={msg.role} content={msg.content} />
            ))}
            {isLoading && (
              <div className={styles.message + ' ' + styles.messageAssistant}>
                <div className={`${styles.messageAvatar} ${styles.avatarAssistant}`}>🤖</div>
                <div className={styles.thinking}>
                  <div className={styles.thinkingDots}>
                    <div className={styles.thinkingDot} />
                    <div className={styles.thinkingDot} />
                    <div className={styles.thinkingDot} />
                  </div>
                  <span>Analyzing data...</span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={styles.chatInputArea}>
        <form onSubmit={handleSubmit}>
          <div className={styles.chatInputWrapper}>
            <textarea
              ref={inputRef}
              className={styles.chatInput}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about pipeline, revenue, sectors..."
              rows={1}
              disabled={isLoading}
            />
            <button
              type="submit"
              className={styles.chatSendBtn}
              disabled={!input.trim() || isLoading}
            >
              ➤
            </button>
          </div>
        </form>
        <div className={styles.chatPowered}>
          Powered by GPT-4 • Data from Monday.com
        </div>
      </div>
    </div>
  );
}
