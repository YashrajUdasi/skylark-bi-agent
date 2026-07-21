'use client';

import { useState, useEffect } from 'react';
import KPIGrid from '@/components/Dashboard/KPIGrid';
import ChatInterface from '@/components/Chat/ChatInterface';

/**
 * Main Application Page
 * 
 * Split layout:
 * - Left: Dashboard with KPIs and Charts
 * - Right: Chat Interface (primary interaction)
 * 
 * On mobile: stacks vertically (chat on top, dashboard below)
 */
export default function HomePage() {
  const [healthStatus, setHealthStatus] = useState(null);

  useEffect(() => {
    checkHealth();
  }, []);

  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthStatus(data);
    } catch {
      setHealthStatus({ healthy: false, error: 'Unable to reach server' });
    }
  }

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="app-header__logo">
          <div className="app-header__logo-icon">🚁</div>
          <div>
            <div className="app-header__title">Skylark BI Agent</div>
            <div className="app-header__subtitle">Monday.com Business Intelligence</div>
          </div>
        </div>
        <div className="app-header__actions">
          {healthStatus && (
            <span className={`badge ${healthStatus.healthy ? 'badge--success' : 'badge--danger'}`}>
              {healthStatus.healthy ? '● Connected' : '● Disconnected'}
            </span>
          )}
          <a href="/report" className="btn btn--sm">
            📊 Report
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Dashboard Panel */}
        <section className="app-dashboard">
          {healthStatus && !healthStatus.healthy ? (
            <div style={{
              padding: '48px 24px',
              textAlign: 'center',
              maxWidth: '500px',
              margin: '0 auto',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚙️</div>
              <h2 style={{ marginBottom: '12px' }}>Configuration Required</h2>
              <p style={{ marginBottom: '20px', lineHeight: 1.7 }}>
                Please configure your environment variables in <code>.env.local</code> to connect to Monday.com and OpenAI.
              </p>
              <div style={{
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                textAlign: 'left',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                lineHeight: 1.8,
              }}>
                MONDAY_API_TOKEN=your_token<br/>
                MONDAY_WORK_ORDERS_BOARD_ID=board_id<br/>
                MONDAY_DEALS_BOARD_ID=board_id<br/>
                OPENAI_API_KEY=your_key
              </div>
              {healthStatus.details?.connection?.error && (
                <p style={{
                  marginTop: '16px',
                  fontSize: '0.78rem',
                  color: 'var(--accent-danger)',
                }}>
                  Error: {healthStatus.details.connection.error}
                </p>
              )}
              <button className="btn" onClick={checkHealth} style={{ marginTop: '16px' }}>
                🔄 Retry Connection
              </button>
            </div>
          ) : (
            <KPIGrid />
          )}
        </section>

        {/* Chat Panel */}
        <aside className="app-chat">
          <ChatInterface />
        </aside>
      </main>
    </div>
  );
}
