'use client';

import ReactMarkdown from 'react-markdown';
import styles from './ChatInterface.module.css';

/**
 * ChatMessage Component
 * 
 * Renders a single chat message with appropriate styling for user vs assistant.
 * Assistant messages support full Markdown rendering.
 *
 * @param {Object} props
 * @param {'user'|'assistant'} props.role - Message sender role
 * @param {string} props.content - Message text content
 */
export default function ChatMessage({ role, content }) {
  const isUser = role === 'user';

  return (
    <div className={`${styles.message} ${isUser ? styles.messageUser : styles.messageAssistant}`}>
      <div className={`${styles.messageAvatar} ${isUser ? styles.avatarUser : styles.avatarAssistant}`}>
        {isUser ? '👤' : '🤖'}
      </div>
      <div className={`${styles.messageBubble} ${isUser ? styles.bubbleUser : styles.bubbleAssistant}`}>
        {isUser ? (
          content
        ) : (
          <ReactMarkdown>{content}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}
