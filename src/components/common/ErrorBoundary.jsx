'use client';

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          margin: '24px auto',
          maxWidth: '600px',
          background: 'rgba(225, 112, 85, 0.08)',
          border: '1px solid rgba(225, 112, 85, 0.2)',
          borderRadius: '12px',
          color: '#e8e9f0',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <h2 style={{ color: '#e17055', marginBottom: '12px' }}>Something went wrong</h2>
          <p style={{ marginBottom: '16px', color: '#8b8d9e' }}>
            The application encountered an unexpected error. 
          </p>
          <details style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', background: '#12131a', padding: '12px', borderRadius: '6px' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo?.componentStack}
          </details>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              background: '#e17055',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
