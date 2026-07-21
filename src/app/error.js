'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Next.js caught an error:', error);
  }, [error]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🚨</div>
      <h2 style={{ marginBottom: '12px' }}>Application Error</h2>
      <p style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>
        {error.message || 'An unexpected error occurred while rendering the page.'}
      </p>
      <button 
        onClick={() => reset()}
        className="btn btn--primary"
      >
        Try Again
      </button>
    </div>
  );
}
