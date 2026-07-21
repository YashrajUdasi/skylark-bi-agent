'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import styles from './Charts.module.css';

const STAGE_COLORS = {
  'Lead': '#74b9ff',
  'Proposal': '#6c5ce7',
  'D. Feasibility': '#a29bfe',
  'On Hold': '#636e72',
  'H. Work Order Received': '#55efc4',
  'Negotiation': '#fdcb6e',
  'Completed': '#00b894',
  'Deal Stage': '#dfe6e9',
  'N. Not Relevant At The Moment': '#b2bec3',
  'Closed Lost': '#d63031',
  'O. Not Relevant At All': '#b2bec3',
  'J. Invoice Sent': '#00b894',
  'I. POC': '#00cec9',
  'Closed Won': '#00b894',
  'K. Amount Accrued': '#00b894'
};

const DEFAULT_COLOR = '#6c5ce7';

/**
 * Formats large numbers compactly.
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
 * Custom tooltip for pipeline chart.
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
        {data.stage}
      </div>
      <div style={{ color: 'var(--text-secondary)' }}>
        Deals: {data.count} • Value: {formatValue(data.value)}
      </div>
    </div>
  );
}

/**
 * Pipeline Chart — Bar chart showing deals by pipeline stage.
 * 
 * @param {Object} props
 * @param {Object} props.data - Pipeline data from analytics engine
 */
export default function PipelineChart({ data }) {
  // Support both stageBreakdown (new) and stages (legacy)
  const stagesObj = data?.stageBreakdown || data?.stages || {};
  if (!stagesObj || Object.keys(stagesObj).length === 0) {
    return <div className={styles.emptyChart}>No pipeline data available</div>;
  }

  const chartData = Object.entries(stagesObj)
    .map(([stage, info]) => ({
      stage: stage.length > 18 ? stage.substring(0, 16) + '…' : stage,
      fullStage: stage,
      count: info.count || 0,
      value: info.value || 0,
      color: STAGE_COLORS[stage] || DEFAULT_COLOR,
    }))
    .sort((a, b) => {
      const order = Object.keys(STAGE_COLORS);
      const ai = order.indexOf(a.fullStage);
      const bi = order.indexOf(b.fullStage);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return b.value - a.value;
    });

  return (
    <div className={styles.chartWrapper}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
          <XAxis
            dataKey="stage"
            tick={{ fill: '#8b8d9e', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            tickLine={false}
            angle={-30}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fill: '#8b8d9e', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
