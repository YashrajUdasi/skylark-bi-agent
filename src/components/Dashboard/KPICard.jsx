'use client';

import styles from './Dashboard.module.css';

/**
 * KPI Card Component
 * 
 * Displays a single KPI metric with icon, value, label, and optional trend.
 * Supports loading skeleton state and quality indicators.
 *
 * @param {Object} props
 * @param {string} props.label - KPI label (e.g., "Total Revenue")
 * @param {string|number} props.value - KPI display value (formatted)
 * @param {string} props.icon - Emoji icon
 * @param {string} [props.trend] - Trend direction: 'up', 'down', 'neutral'
 * @param {string} [props.trendValue] - Trend display text (e.g., "+12%")
 * @param {string} [props.subtext] - Additional context text
 * @param {string} [props.accentColor] - CSS color for accent
 * @param {boolean} [props.loading] - Show skeleton state
 */
export default function KPICard({
  label,
  value,
  icon,
  trend,
  trendValue,
  subtext,
  accentColor,
  loading = false,
}) {
  if (loading) {
    return (
      <div className={`${styles.kpiCard} ${styles.kpiSkeleton} skeleton`} />
    );
  }

  const cardStyle = accentColor
    ? { '--kpi-accent': accentColor, '--kpi-bg': `${accentColor}18` }
    : {};

  return (
    <div className={styles.kpiCard} style={cardStyle}>
      {icon && (
        <div className={styles.kpiIcon}>
          {icon}
        </div>
      )}
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value ?? '—'}</div>
      {trend && trendValue && (
        <div className={`${styles.kpiTrend} ${styles[`kpiTrend--${trend}`]}`}>
          <span>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}</span>
          <span>{trendValue}</span>
        </div>
      )}
      {subtext && <div className={styles.kpiSubtext}>{subtext}</div>}
    </div>
  );
}
