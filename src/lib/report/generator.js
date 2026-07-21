/**
 * Leadership Report Generator
 * 
 * Generates structured leadership update data from analytics.
 * This is called by the AI tool "generate_leadership_update" and
 * also used by the report page component.
 */

const {
  getDashboardSummary,
  getDataQualityReport,
  getSectorAnalysis,
} = require('../analytics/engine');

/**
 * Formats a number in Indian currency style (Lakhs/Crores).
 *
 * @param {number} value - Numeric value
 * @returns {string} Formatted string (e.g., "₹1.5 Cr" or "₹25 L")
 */
function formatINR(value) {
  if (!value || isNaN(value)) return '₹0';

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 10000000) {
    return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  }
  if (abs >= 100000) {
    return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  }
  return `${sign}₹${abs.toFixed(0)}`;
}

/**
 * Generates a comprehensive leadership report.
 *
 * @param {string|null} focusAreas - Comma-separated focus areas (optional)
 * @returns {Promise<Object>} Structured report data
 */
async function generateLeadershipReport(focusAreas = null) {
  const [dashboard, qualityReport, sectorAnalysis] = await Promise.all([
    getDashboardSummary(),
    getDataQualityReport(),
    getSectorAnalysis(),
  ]);

  const kpis = dashboard.kpis;
  const pipeline = dashboard.pipeline;
  const winLoss = dashboard.winLoss;
  const operations = dashboard.operations;

  // Parse focus areas
  const focus = focusAreas
    ? focusAreas.split(',').map((f) => f.trim().toLowerCase())
    : null;

  const shouldInclude = (area) => !focus || focus.some((f) =>
    area.toLowerCase().includes(f) || f.includes(area.toLowerCase())
  );

  // Build report sections
  const report = {
    title: 'Leadership Update — Skylark Drones',
    generatedAt: new Date().toISOString(),
    focusAreas: focus,

    executiveSummary: buildExecutiveSummary(kpis, pipeline, winLoss, operations),

    sections: [],
  };

  // Pipeline Health
  if (shouldInclude('pipeline')) {
    report.sections.push({
      title: 'Pipeline Health',
      type: 'pipeline',
      data: {
        totalDeals: kpis.totalDeals,
        totalPipelineValue: kpis.totalPipelineValue,
        formattedPipelineValue: formatINR(kpis.totalPipelineValue),
        weightedPipelineValue: kpis.weightedPipelineValue,
        formattedWeightedValue: formatINR(kpis.weightedPipelineValue),
        stages: pipeline.stages || {},
        stageBreakdown: Object.entries(pipeline.stages || {}).map(([stage, data]) => ({
          stage,
          count: data.count,
          value: data.value,
          formattedValue: formatINR(data.value),
          weight: (data.weight * 100).toFixed(0) + '%',
        })),
      },
    });
  }

  // Revenue Performance
  if (shouldInclude('revenue')) {
    report.sections.push({
      title: 'Revenue Performance',
      type: 'revenue',
      data: {
        wonRevenue: winLoss.wonRevenue,
        formattedWonRevenue: formatINR(winLoss.wonRevenue),
        winRate: winLoss.winRate,
        avgDealSize: winLoss.avgDealSize,
        formattedAvgDealSize: formatINR(winLoss.avgDealSize),
        closedWon: winLoss.closedWon,
        closedLost: winLoss.closedLost,
        totalClosed: winLoss.totalClosed,
      },
    });
  }

  // Sector Analysis
  if (shouldInclude('sector')) {
    const topSectors = Object.entries(sectorAnalysis.sectors || {})
      .sort(([, a], [, b]) => b.totalValue - a.totalValue)
      .slice(0, 5)
      .map(([name, data]) => ({
        name,
        dealCount: data.deals?.count || 0,
        dealValue: data.deals?.value || 0,
        formattedDealValue: formatINR(data.deals?.value || 0),
        woCount: data.workOrders?.count || 0,
        woValue: data.workOrders?.value || 0,
      }));

    report.sections.push({
      title: 'Sector Analysis',
      type: 'sectors',
      data: {
        totalSectors: sectorAnalysis.totalSectors,
        topSectors,
      },
    });
  }

  // Operational Highlights
  if (shouldInclude('operations') || shouldInclude('operational')) {
    report.sections.push({
      title: 'Operational Highlights',
      type: 'operations',
      data: {
        totalWorkOrders: operations.totalWorkOrders,
        completedCount: operations.completedCount,
        inProgressCount: operations.inProgressCount,
        completionRate: operations.completionRate,
        statusBreakdown: Object.entries(operations.statusDistribution || {}).map(([status, count]) => ({
          status,
          count,
        })),
      },
    });
  }

  // Risks & Attention Items
  report.sections.push({
    title: 'Risks & Attention Items',
    type: 'risks',
    data: {
      dataQualityScore: qualityReport.overallScore,
      issues: (qualityReport.allIssues || []).slice(0, 5),
      riskItems: identifyRisks(kpis, pipeline, operations, qualityReport),
    },
  });

  return report;
}

/**
 * Builds the executive summary paragraph.
 */
function buildExecutiveSummary(kpis, pipeline, winLoss, operations) {
  const parts = [];

  parts.push(
    `The current pipeline stands at ${formatINR(kpis.totalPipelineValue)} across ${kpis.totalDeals} deals, ` +
    `with a weighted pipeline value of ${formatINR(kpis.weightedPipelineValue)}.`
  );

  if (winLoss.winRate > 0) {
    parts.push(
      `Win rate is at ${winLoss.winRate}% with ${winLoss.closedWon} deals closed successfully, ` +
      `generating ${formatINR(winLoss.wonRevenue)} in revenue.`
    );
  }

  if (operations.totalWorkOrders > 0) {
    parts.push(
      `On the operations side, ${operations.completedCount} of ${operations.totalWorkOrders} ` +
      `work orders are completed (${operations.completionRate}% completion rate), ` +
      `with ${operations.inProgressCount} currently in progress.`
    );
  }

  return parts.join(' ');
}

/**
 * Identifies potential risk items from the data.
 */
function identifyRisks(kpis, pipeline, operations, quality) {
  const risks = [];

  // Low win rate
  if (kpis.winRate > 0 && kpis.winRate < 30) {
    risks.push({
      severity: 'high',
      title: 'Low Win Rate',
      description: `Win rate is at ${kpis.winRate}%, which is below the 30% threshold. Review lost deals for patterns.`,
    });
  }

  // Low completion rate
  if (operations.completionRate > 0 && operations.completionRate < 50) {
    risks.push({
      severity: 'high',
      title: 'Low Work Order Completion',
      description: `Only ${operations.completionRate}% of work orders are completed. Investigate potential bottlenecks.`,
    });
  }

  // Data quality issues
  if (quality.overallScore < 60) {
    risks.push({
      severity: 'medium',
      title: 'Data Quality Concerns',
      description: `Overall data quality score is ${quality.overallScore}/100. Some insights may be incomplete due to missing or inconsistent data.`,
    });
  }

  // Pipeline concentration (if top stage has >50% of value)
  if (pipeline.stages) {
    const stageValues = Object.values(pipeline.stages).map((s) => s.value || 0);
    const maxStageValue = Math.max(...stageValues);
    if (kpis.totalPipelineValue > 0 && maxStageValue / kpis.totalPipelineValue > 0.5) {
      const topStage = Object.entries(pipeline.stages).find(([, s]) => s.value === maxStageValue);
      if (topStage) {
        risks.push({
          severity: 'medium',
          title: 'Pipeline Concentration Risk',
          description: `Over 50% of pipeline value is concentrated in the "${topStage[0]}" stage. Diversify pipeline stages for stability.`,
        });
      }
    }
  }

  if (risks.length === 0) {
    risks.push({
      severity: 'low',
      title: 'No Major Risks Identified',
      description: 'Business metrics appear healthy based on available data.',
    });
  }

  return risks;
}

module.exports = {
  generateLeadershipReport,
  formatINR,
};
