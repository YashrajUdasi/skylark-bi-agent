/**
 * Analytics Engine (v2)
 *
 * Uses exact column mappings from column-map.js instead of keyword heuristics.
 * This guarantees correct field resolution for Skylark Drones' Monday.com boards.
 */

const { fetchAllData, refreshAllData } = require('../data/fetcher');
const { cleanAllData } = require('../data/cleaner');
const cache = require('../data/cache');
const {
  DEALS_COLUMN_MAP,
  WORK_ORDERS_COLUMN_MAP,
  STAGE_WEIGHTS,
  WON_STAGES,
  LOST_STAGES,
  COMPLETED_STATUSES,
} = require('./column-map');

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function safeSum(records, field) {
  return records.reduce((sum, r) => sum + safeNum(r[field]), 0);
}

function countBy(records, field) {
  const out = {};
  for (const r of records) {
    const k = r[field] || 'Unknown';
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function sumBy(records, numField, groupField) {
  const out = {};
  for (const r of records) {
    const g = r[groupField] || 'Unknown';
    out[g] = (out[g] || 0) + safeNum(r[numField]);
  }
  return out;
}

function resolveColumn(schema, exactName, fallbackNames = []) {
  const cols = schema.columns.map(c => c.title);
  if (cols.includes(exactName)) return exactName;
  for (const fb of fallbackNames) {
    if (cols.includes(fb)) return fb;
  }
  // fuzzy: first column containing keyword
  return null;
}

// ─── Core Data Access ────────────────────────────────────────────────────────

async function getCleanData(forceRefresh = false) {
  const cacheKey = 'analytics:cleanData';
  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }
  const rawData = forceRefresh ? await refreshAllData() : await fetchAllData();
  const cleanedData = cleanAllData(rawData);
  cache.set(cacheKey, cleanedData);
  return cleanedData;
}

// ─── Deals Analytics ────────────────────────────────────────────────────────

function computePipelineMetrics(deals, schema) {
  const valueCol = resolveColumn(schema, DEALS_COLUMN_MAP.value, ['Deal Value', 'value', 'amount']);
  const stageCol = resolveColumn(schema, DEALS_COLUMN_MAP.stage, ['Stage', 'Deal Stage', 'status']);
  const sectorCol = resolveColumn(schema, DEALS_COLUMN_MAP.sector, ['Sector', 'sector', 'industry']);

  console.log(`[Analytics] Deals columns resolved → value: "${valueCol}", stage: "${stageCol}", sector: "${sectorCol}"`);

  const stageBreakdown = {};
  let totalPipelineValue = 0;
  let weightedPipelineValue = 0;
  let missingValueCount = 0;

  const stageCounts = stageCol ? countBy(deals, stageCol) : {};
  const stageValues = (stageCol && valueCol) ? sumBy(deals, valueCol, stageCol) : {};

  for (const deal of deals) {
    const val = valueCol ? safeNum(deal[valueCol]) : 0;
    if (!val) missingValueCount++;
    totalPipelineValue += val;

    const stage = (stageCol ? deal[stageCol] : null) || 'Unknown';
    const weight = STAGE_WEIGHTS[stage] !== undefined ? STAGE_WEIGHTS[stage] : 0.25;
    weightedPipelineValue += val * weight;
  }

  for (const [stage, count] of Object.entries(stageCounts)) {
    const value = stageValues[stage] || 0;
    const weight = STAGE_WEIGHTS[stage] !== undefined ? STAGE_WEIGHTS[stage] : 0.25;
    stageBreakdown[stage] = { count, value, weight, weightedValue: value * weight };
  }

  // Sector breakdown
  const sectorCounts = sectorCol ? countBy(deals, sectorCol) : {};
  const sectorValues = (sectorCol && valueCol) ? sumBy(deals, valueCol, sectorCol) : {};

  return {
    totalDeals: deals.length,
    totalPipelineValue,
    weightedPipelineValue,
    missingValueCount,
    stageBreakdown,
    sectorBreakdown: Object.entries(sectorCounts).map(([sector, count]) => ({
      sector,
      count,
      value: sectorValues[sector] || 0,
    })).sort((a, b) => b.count - a.count),
    valueColumn: valueCol,
    stageColumn: stageCol,
    sectorColumn: sectorCol,
  };
}

function computeWinLoss(deals, schema) {
  const stageCol = resolveColumn(schema, DEALS_COLUMN_MAP.stage, ['Stage', 'Deal Stage']);
  const valueCol = resolveColumn(schema, DEALS_COLUMN_MAP.value, ['Deal Value']);

  if (!stageCol) return { winRate: 0, closedWon: 0, closedLost: 0, wonRevenue: 0 };

  const won = deals.filter(d => WON_STAGES.includes(d[stageCol]));
  const lost = deals.filter(d => LOST_STAGES.includes(d[stageCol]));
  const totalClosed = won.length + lost.length;

  return {
    winRate: totalClosed > 0 ? Math.round((won.length / totalClosed) * 1000) / 10 : 0,
    closedWon: won.length,
    closedLost: lost.length,
    totalClosed,
    wonRevenue: valueCol ? safeSum(won, valueCol) : 0,
    lostRevenue: valueCol ? safeSum(lost, valueCol) : 0,
    avgDealSize: (won.length > 0 && valueCol) ? safeSum(won, valueCol) / won.length : 0,
  };
}

// ─── Work Orders Analytics ───────────────────────────────────────────────────

function computeOperationalMetrics(workOrders, schema) {
  const statusCol = resolveColumn(schema, WORK_ORDERS_COLUMN_MAP.status, ['Status', 'WO Status', 'Execution Status']);
  const valueCol = resolveColumn(schema, WORK_ORDERS_COLUMN_MAP.value, ['Amount in Rupees (Excl of GST) (Masked)', 'Amount']);
  const sectorCol = resolveColumn(schema, WORK_ORDERS_COLUMN_MAP.sector, ['Sector', 'sector']);

  console.log(`[Analytics] WO columns resolved → status: "${statusCol}", value: "${valueCol}", sector: "${sectorCol}"`);

  const completed = statusCol ? workOrders.filter(wo => {
    const s = (wo[statusCol] || '').toLowerCase();
    return COMPLETED_STATUSES.some(cs => s.includes(cs));
  }) : [];

  const inProgress = statusCol ? workOrders.filter(wo => {
    const s = (wo[statusCol] || '').toLowerCase();
    return s.includes('ongoing') || s.includes('not started') || s === 'open';
  }) : [];

  const totalValue = valueCol ? safeSum(workOrders, valueCol) : 0;
  const statusDist = statusCol ? countBy(workOrders, statusCol) : {};
  const sectorCounts = sectorCol ? countBy(workOrders, sectorCol) : {};
  const sectorValues = (sectorCol && valueCol) ? sumBy(workOrders, valueCol, sectorCol) : {};

  return {
    totalWorkOrders: workOrders.length,
    completedCount: completed.length,
    inProgressCount: inProgress.length,
    completionRate: workOrders.length > 0
      ? Math.round((completed.length / workOrders.length) * 1000) / 10 : 0,
    totalValue,
    statusDistribution: statusDist,
    sectorBreakdown: Object.entries(sectorCounts).map(([sector, count]) => ({
      sector, count, value: sectorValues[sector] || 0,
    })).sort((a, b) => b.count - a.count),
    valueColumn: valueCol,
    statusColumn: statusCol,
    sectorColumn: sectorCol,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

async function getDashboardSummary() {
  const data = await getCleanData();

  const pipeline = computePipelineMetrics(data.deals.records, data.deals.schema);
  const winLoss = computeWinLoss(data.deals.records, data.deals.schema);
  const operations = computeOperationalMetrics(data.workOrders.records, data.workOrders.schema);

  return {
    kpis: {
      totalDeals: data.deals.totalItems,
      totalWorkOrders: data.workOrders.totalItems,
      totalPipelineValue: pipeline.totalPipelineValue,
      weightedPipelineValue: pipeline.weightedPipelineValue,
      missingValueCount: pipeline.missingValueCount,
      winRate: winLoss.winRate,
      wonRevenue: winLoss.wonRevenue,
      avgDealSize: winLoss.avgDealSize,
      completionRate: operations.completionRate,
      totalWOValue: operations.totalValue,
    },
    pipeline,
    winLoss,
    operations,
    quality: data.overallQuality,
    boards: {
      workOrders: { name: data.workOrders.boardName, itemCount: data.workOrders.totalItems },
      deals: { name: data.deals.boardName, itemCount: data.deals.totalItems },
    },
    generatedAt: new Date().toISOString(),
  };
}

async function queryWorkOrders(filters = {}) {
  const data = await getCleanData();
  let records = [...data.workOrders.records];
  const schema = data.workOrders.schema;

  const sectorCol = resolveColumn(schema, WORK_ORDERS_COLUMN_MAP.sector, ['Sector']);
  const statusCol = resolveColumn(schema, WORK_ORDERS_COLUMN_MAP.status, ['Execution Status']);

  if (filters.sector && sectorCol) {
    const q = filters.sector.toLowerCase();
    records = records.filter(r => (r[sectorCol] || '').toLowerCase().includes(q));
  }
  if (filters.status && statusCol) {
    const q = filters.status.toLowerCase();
    records = records.filter(r => (r[statusCol] || '').toLowerCase().includes(q));
  }
  if (filters.limit) records = records.slice(0, filters.limit);

  return {
    records: records.slice(0, 20),
    totalFound: records.length,
    totalInBoard: data.workOrders.totalItems,
    filtersApplied: filters,
  };
}

async function queryDeals(filters = {}) {
  const data = await getCleanData();
  let records = [...data.deals.records];
  const schema = data.deals.schema;

  const sectorCol = resolveColumn(schema, DEALS_COLUMN_MAP.sector, ['Sector/service', 'Sector']);
  const stageCol = resolveColumn(schema, DEALS_COLUMN_MAP.stage, ['Deal Stage', 'Stage']);

  if (filters.sector && sectorCol) {
    const q = filters.sector.toLowerCase();
    records = records.filter(r => (r[sectorCol] || '').toLowerCase().includes(q));
  }
  if (filters.status && stageCol) {
    const q = filters.status.toLowerCase();
    records = records.filter(r => (r[stageCol] || '').toLowerCase().includes(q));
  }
  if (filters.limit) records = records.slice(0, filters.limit);

  return {
    records: records.slice(0, 20),
    totalFound: records.length,
    totalInBoard: data.deals.totalItems,
    filtersApplied: filters,
  };
}

async function getPipelineAnalysis(filters = {}) {
  const data = await getCleanData();
  let deals = [...data.deals.records];
  const schema = data.deals.schema;

  if (filters.sector) {
    const sectorCol = resolveColumn(schema, DEALS_COLUMN_MAP.sector, ['Sector/service']);
    if (sectorCol) {
      const q = filters.sector.toLowerCase();
      deals = deals.filter(r => (r[sectorCol] || '').toLowerCase().includes(q));
    }
  }

  const pipeline = computePipelineMetrics(deals, schema);
  const winLoss = computeWinLoss(deals, schema);
  return { ...pipeline, winLoss, filtersApplied: filters, recordCount: deals.length };
}

async function getRevenueMetrics(filters = {}) {
  const data = await getCleanData();
  let deals = [...data.deals.records];
  let wos = [...data.workOrders.records];

  const dealSectorCol = resolveColumn(data.deals.schema, DEALS_COLUMN_MAP.sector, ['Sector/service']);
  const woSectorCol = resolveColumn(data.workOrders.schema, WORK_ORDERS_COLUMN_MAP.sector, ['Sector']);
  const dealValueCol = resolveColumn(data.deals.schema, DEALS_COLUMN_MAP.value);
  const woValueCol = resolveColumn(data.workOrders.schema, WORK_ORDERS_COLUMN_MAP.value);

  if (filters.sector) {
    const q = filters.sector.toLowerCase();
    if (dealSectorCol) deals = deals.filter(r => (r[dealSectorCol] || '').toLowerCase().includes(q));
    if (woSectorCol) wos = wos.filter(r => (r[woSectorCol] || '').toLowerCase().includes(q));
  }

  const revenueBySector = {};
  if (dealSectorCol && dealValueCol) {
    for (const r of deals) {
      const s = r[dealSectorCol] || 'Unknown';
      revenueBySector[s] = (revenueBySector[s] || 0) + safeNum(r[dealValueCol]);
    }
  }

  return {
    totalDealValue: dealValueCol ? safeSum(deals, dealValueCol) : 0,
    totalWOValue: woValueCol ? safeSum(wos, woValueCol) : 0,
    avgDealValue: deals.length > 0 && dealValueCol ? safeSum(deals, dealValueCol) / deals.length : 0,
    dealCount: deals.length,
    woCount: wos.length,
    revenueBySector,
    dealValueColumn: dealValueCol,
    filtersApplied: filters,
  };
}

async function getSectorAnalysis() {
  const data = await getCleanData();

  const dealSectorCol = resolveColumn(data.deals.schema, DEALS_COLUMN_MAP.sector, ['Sector/service']);
  const woSectorCol = resolveColumn(data.workOrders.schema, WORK_ORDERS_COLUMN_MAP.sector, ['Sector']);
  const dealValueCol = resolveColumn(data.deals.schema, DEALS_COLUMN_MAP.value);
  const woValueCol = resolveColumn(data.workOrders.schema, WORK_ORDERS_COLUMN_MAP.value);

  const dealSectorCounts = dealSectorCol ? countBy(data.deals.records, dealSectorCol) : {};
  const dealSectorValues = (dealSectorCol && dealValueCol) ? sumBy(data.deals.records, dealValueCol, dealSectorCol) : {};
  const woSectorCounts = woSectorCol ? countBy(data.workOrders.records, woSectorCol) : {};
  const woSectorValues = (woSectorCol && woValueCol) ? sumBy(data.workOrders.records, woValueCol, woSectorCol) : {};

  const allSectors = new Set([...Object.keys(dealSectorCounts), ...Object.keys(woSectorCounts)]);
  const sectors = {};
  for (const sector of allSectors) {
    sectors[sector] = {
      deals: { count: dealSectorCounts[sector] || 0, value: dealSectorValues[sector] || 0 },
      workOrders: { count: woSectorCounts[sector] || 0, value: woSectorValues[sector] || 0 },
      totalCount: (dealSectorCounts[sector] || 0) + (woSectorCounts[sector] || 0),
      totalValue: (dealSectorValues[sector] || 0) + (woSectorValues[sector] || 0),
    };
  }

  return { sectors, totalSectors: allSectors.size, dealSectorColumn: dealSectorCol, woSectorColumn: woSectorCol };
}

async function getDataQualityReport() {
  const data = await getCleanData();
  return data.overallQuality;
}

async function searchAcrossBoards(query, limit = 20) {
  const data = await getCleanData();
  const q = query.toLowerCase();

  const search = (records, board) =>
    records.filter(r => Object.values(r).some(v => String(v || '').toLowerCase().includes(q)))
      .slice(0, limit).map(r => ({ ...r, _board: board }));

  const dealResults = search(data.deals.records, 'Deals');
  const woResults = search(data.workOrders.records, 'Work Orders');

  return {
    results: [...dealResults, ...woResults].slice(0, limit),
    totalDealMatches: dealResults.length,
    totalWorkOrderMatches: woResults.length,
    query,
  };
}

async function getBoardSchemas() {
  const data = await getCleanData();
  return {
    workOrders: {
      name: data.workOrders.boardName,
      columns: data.workOrders.schema.columns.map(c => ({ title: c.title, type: c.type })),
    },
    deals: {
      name: data.deals.boardName,
      columns: data.deals.schema.columns.map(c => ({ title: c.title, type: c.type })),
    },
  };
}

module.exports = {
  getCleanData,
  getDashboardSummary,
  queryWorkOrders,
  queryDeals,
  getPipelineAnalysis,
  getRevenueMetrics,
  getSectorAnalysis,
  getDataQualityReport,
  searchAcrossBoards,
  getBoardSchemas,
};
