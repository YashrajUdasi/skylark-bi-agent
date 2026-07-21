'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './Charts.module.css';

const COLORS = [
  '#6c5ce7', '#00cec9', '#00b894', '#fdcb6e', '#e17055',
  '#74b9ff', '#a29bfe', '#55efc4', '#fab1a0', '#81ecec',
  '#ff7675', '#ffeaa7',
];

/**
 * Formats a number as INR.
 */
function formatValue(value) {
  if (!value || isNaN(value)) return '₹0';
  const abs = Math.abs(value);
  if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `₹${(abs / 1000).toFixed(0)}K`;
  return `₹${abs.toFixed(0)}`;
}

/**
 * Custom tooltip.
 */
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      border: '1px solid var(--border-medium)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 14px',
      fontSize: '0.78rem',
    }}>
      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
        {data.name}
      </div>
      <div style={{ color: 'var(--text-secondary)' }}>
        {data.count} deals • {formatValue(data.value)} ({data.percentage}%)
      </div>
    </div>
  );
}

/**
 * Custom label renderer for pie segments.
 */
function renderLabel({ name, percentage, cx, cy, midAngle, innerRadius, outerRadius }) {
  if (percentage < 5) return null; // Skip tiny slices
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 18;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#8b8d9e"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={11}
    >
      {name.length > 10 ? name.substring(0, 9) + '…' : name}
    </text>
  );
}

/**
 * Sector Chart — Donut chart showing revenue distribution by sector.
 *
 * @param {Object} props
 * @param {Object} props.data - Sector data from analytics engine
 */
export default function SectorChart({ data }) {
  // Support both new array format (sectorBreakdown) and old object format (sectors)
  let chartData = [];

  if (data?.sectorBreakdown && Array.isArray(data.sectorBreakdown)) {
    // New format: [{sector, count, value}]
    const totalValue = data.sectorBreakdown.reduce((s, r) => s + (r.value || 0), 0);
    chartData = data.sectorBreakdown
      .filter(r => r.count > 0)
      .map((r, idx) => ({
        name: r.sector,
        count: r.count,
        value: r.value || 0,
        percentage: totalValue > 0 ? Math.round((r.value / totalValue) * 100) : 0,
        color: COLORS[idx % COLORS.length],
      }))
      .sort((a, b) => b.count - a.count);
  } else if (data?.sectors && Object.keys(data.sectors).length > 0) {
    // Legacy format: {sectorName: {count, value, percentage}}
    chartData = Object.entries(data.sectors)
      .filter(([, info]) => info.count > 0)
      .map(([name, info], idx) => ({
        name,
        count: info.count || 0,
        value: info.value || 0,
        percentage: info.percentage || 0,
        color: COLORS[idx % COLORS.length],
      }))
      .sort((a, b) => b.count - a.count);
  }

  if (chartData.length === 0) {
    return <div className={styles.emptyChart}>No sector data available</div>;
  }

  return (
    <div className={styles.chartWrapper}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            label={renderLabel}
            labelLine={false}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={0.85} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className={styles.chartLegend}>
        {chartData.slice(0, 6).map((item, i) => (
          <div key={i} className={styles.legendItem}>
            <div className={styles.legendDot} style={{ background: item.color }} />
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
