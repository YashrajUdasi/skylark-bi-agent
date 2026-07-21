'use client';

import { useState, useEffect } from 'react';
import KPICard from './KPICard';
import PipelineChart from '../Charts/PipelineChart';
import SectorChart from '../Charts/SectorChart';
import styles from './Dashboard.module.css';

/**
 * Formats large numbers in Indian currency style.
 */
function formatINR(value) {
  if (!value || isNaN(value)) return '₹0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

/**
 * KPI Grid Component
 * 
 * Fetches dashboard summary data and displays a grid of KPI cards
 * along with pipeline and sector charts.
 */
export default function KPIGrid() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/analytics');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h3>⚠️ Unable to load dashboard</h3>
        <p>{error}</p>
        <button className="btn" onClick={fetchDashboard} style={{ marginTop: '12px' }}>
          Retry
        </button>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const qualityScore = data?.quality?.overallScore || 0;

  return (
    <div className="fade-in">
      {/* Quality indicator */}
      {data && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div
            className={`${styles.qualityDot} ${
              qualityScore >= 70 ? styles['qualityDot--good'] :
              qualityScore >= 40 ? styles['qualityDot--medium'] :
              styles['qualityDot--poor']
            }`}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
            Data Quality: {qualityScore}/100 • {data?.boards?.workOrders?.itemCount || 0} Work Orders • {data?.boards?.deals?.itemCount || 0} Deals
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className={styles.sectionTitle}>Key Metrics</div>
      <div className={styles.kpiGrid}>
        <KPICard
          icon="💰"
          label="Pipeline Value"
          value={loading ? null : formatINR(kpis.totalPipelineValue)}
          subtext={`Weighted: ${formatINR(kpis.weightedPipelineValue)}`}
          accentColor="#6c5ce7"
          loading={loading}
        />
        <KPICard
          icon="🏆"
          label="Won Revenue"
          value={loading ? null : formatINR(kpis.wonRevenue)}
          subtext={`Avg won deal: ${formatINR(kpis.avgDealSize)}`}
          accentColor="#00b894"
          loading={loading}
        />
        <KPICard
          icon="📊"
          label="Win Rate"
          value={loading ? null : `${kpis.winRate || 0}%`}
          trend={kpis.winRate >= 40 ? 'up' : kpis.winRate >= 20 ? 'neutral' : 'down'}
          trendValue={kpis.winRate >= 40 ? 'Healthy' : kpis.winRate >= 20 ? 'Average' : 'Needs Attention'}
          accentColor={kpis.winRate >= 40 ? '#00b894' : kpis.winRate >= 20 ? '#fdcb6e' : '#e17055'}
          loading={loading}
        />
        <KPICard
          icon="📋"
          label="Total Deals"
          value={loading ? null : kpis.totalDeals}
          accentColor="#74b9ff"
          loading={loading}
        />
        <KPICard
          icon="🚁"
          label="Work Orders"
          value={loading ? null : kpis.totalWorkOrders}
          subtext={`${kpis.completionRate || 0}% complete`}
          accentColor="#00cec9"
          loading={loading}
        />
        <KPICard
          icon="✅"
          label="Completion Rate"
          value={loading ? null : `${kpis.completionRate || 0}%`}
          trend={kpis.completionRate >= 60 ? 'up' : 'neutral'}
          trendValue={kpis.completionRate >= 60 ? 'On Track' : 'In Progress'}
          accentColor="#fdcb6e"
          loading={loading}
        />
      </div>

      {/* Charts */}
      {data && (
        <>
                  <div className={styles.sectionTitle}>Analytics</div>
          <div className={styles.chartsGrid}>
            <div className={styles.chartContainer}>
              <div className={styles.chartTitle}>Pipeline by Stage</div>
              <PipelineChart data={data.pipeline} />
            </div>
            <div className={styles.chartContainer}>
              <div className={styles.chartTitle}>Revenue by Sector</div>
              <SectorChart data={{ sectorBreakdown: data.pipeline?.sectorBreakdown }} />
            </div>
          </div>
          {data.kpis?.missingValueCount > 0 && (
            <div style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--accent-warning)', padding: '6px 10px', background: 'rgba(253,203,110,0.08)', borderRadius: '6px' }}>
              ⚠️ {data.kpis.missingValueCount} deals missing values — pipeline total may be understated
            </div>
          )}
        </>
      )}
    </div>
  );
}
