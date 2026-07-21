'use client';

import { useState, useEffect } from 'react';
import styles from './Report.module.css';

/**
 * Leadership Report Component
 * 
 * Renders a structured leadership update with sections for
 * pipeline, revenue, sectors, operations, and risks.
 */
export default function LeadershipReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReport();
  }, []);

  async function fetchReport() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/report');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingReport}>
        <div className="spinner" />
        <span>Generating leadership update...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.reportContainer}>
        <div className="errorContainer">
          <h3>⚠️ Unable to generate report</h3>
          <p>{error}</p>
          <button className="btn" onClick={fetchReport} style={{ marginTop: '12px' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className={styles.reportContainer}>
      {/* Back link */}
      <a href="/" className={styles.reportBackLink}>← Back to Dashboard</a>

      {/* Header */}
      <div className={styles.reportHeader}>
        <h1 className={styles.reportTitle}>{report.title || 'Leadership Update'}</h1>
        <div className={styles.reportMeta}>
          Generated on {formatDate(report.generatedAt)}
        </div>
      </div>

      {/* Executive Summary */}
      {report.executiveSummary && (
        <div className={styles.reportSection}>
          <div className={styles.reportSectionTitle}>📋 Executive Summary</div>
          <div className={styles.executiveSummary}>
            {report.executiveSummary}
          </div>
        </div>
      )}

      {/* Dynamic Sections */}
      {(report.sections || []).map((section, i) => (
        <div key={i} className={styles.reportSection}>
          <div className={styles.reportSectionTitle}>
            {getSectionIcon(section.type)} {section.title}
          </div>
          {renderSection(section)}
        </div>
      ))}

      {/* Actions */}
      <div className={styles.reportActions}>
        <button className="btn" onClick={() => window.print()}>
          🖨️ Print Report
        </button>
        <a href="/" className="btn btn--primary">
          ← Back to Dashboard
        </a>
      </div>
    </div>
  );
}

function getSectionIcon(type) {
  const icons = {
    pipeline: '📊',
    revenue: '💰',
    sectors: '🏢',
    operations: '🚁',
    risks: '⚠️',
  };
  return icons[type] || '📌';
}

function renderSection(section) {
  switch (section.type) {
    case 'pipeline':
      return renderPipeline(section.data);
    case 'revenue':
      return renderRevenue(section.data);
    case 'sectors':
      return renderSectors(section.data);
    case 'operations':
      return renderOperations(section.data);
    case 'risks':
      return renderRisks(section.data);
    default:
      return <pre>{JSON.stringify(section.data, null, 2)}</pre>;
  }
}

function renderPipeline(data) {
  return (
    <>
      <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Total Deals</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{data.totalDeals}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Pipeline Value</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{data.formattedPipelineValue}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Weighted Value</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{data.formattedWeightedValue}</div>
        </div>
      </div>
      {data.stageBreakdown?.length > 0 && (
        <table className={styles.reportTable}>
          <thead>
            <tr><th>Stage</th><th>Count</th><th>Value</th><th>Weight</th></tr>
          </thead>
          <tbody>
            {data.stageBreakdown.map((s, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{s.stage}</td>
                <td>{s.count}</td>
                <td>{s.formattedValue}</td>
                <td>{s.weight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function renderRevenue(data) {
  return (
    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Won Revenue</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-success)' }}>{data.formattedWonRevenue}</div>
      </div>
      <div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Win Rate</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{data.winRate}%</div>
      </div>
      <div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Avg Deal Size</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{data.formattedAvgDealSize}</div>
      </div>
      <div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Closed Won</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{data.closedWon}</div>
      </div>
      <div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Closed Lost</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-danger)' }}>{data.closedLost}</div>
      </div>
    </div>
  );
}

function renderSectors(data) {
  if (!data.topSectors?.length) return <p>No sector data available.</p>;
  return (
    <table className={styles.reportTable}>
      <thead>
        <tr><th>Sector</th><th>Deals</th><th>Deal Value</th><th>Work Orders</th></tr>
      </thead>
      <tbody>
        {data.topSectors.map((s, i) => (
          <tr key={i}>
            <td style={{ fontWeight: 500 }}>{s.name}</td>
            <td>{s.dealCount}</td>
            <td>{s.formattedDealValue}</td>
            <td>{s.woCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function renderOperations(data) {
  return (
    <>
      <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Total WOs</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{data.totalWorkOrders}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Completed</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-success)' }}>{data.completedCount}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>In Progress</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{data.inProgressCount}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Completion Rate</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{data.completionRate}%</div>
        </div>
      </div>
      {data.statusBreakdown?.length > 0 && (
        <table className={styles.reportTable}>
          <thead>
            <tr><th>Status</th><th>Count</th></tr>
          </thead>
          <tbody>
            {data.statusBreakdown.map((s, i) => (
              <tr key={i}>
                <td>{s.status}</td>
                <td>{s.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function renderRisks(data) {
  return (
    <>
      {data.dataQualityScore !== undefined && (
        <p style={{ marginBottom: '12px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Data Quality Score: <strong>{data.dataQualityScore}/100</strong>
        </p>
      )}
      {(data.riskItems || []).map((risk, i) => (
        <div
          key={i}
          className={`${styles.riskItem} ${
            risk.severity === 'high' ? styles.riskHigh :
            risk.severity === 'medium' ? styles.riskMedium :
            styles.riskLow
          }`}
        >
          <div className={styles.riskTitle}>{risk.title}</div>
          <div className={styles.riskDesc}>{risk.description}</div>
        </div>
      ))}
    </>
  );
}
