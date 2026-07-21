/**
 * KPI Calculations
 * 
 * Pure functions for computing business KPIs from cleaned data.
 * Each function operates on cleaned records and returns structured
 * metrics that can be displayed on the dashboard or used by the AI.
 */

/**
 * Identifies which columns in the schema likely hold revenue/amount data.
 * Uses heuristic matching on column titles.
 *
 * @param {Object} schema - Board schema
 * @returns {string[]} Array of column titles that likely contain monetary values
 */
function findCurrencyColumns(schema) {
  const keywords = ['revenue', 'amount', 'value', 'price', 'cost', 'total', 'deal', 'contract', 'budget', 'payment', 'fee', 'billing', 'invoice'];
  let cols = schema.columns
    .filter((col) => keywords.some((kw) => col.title.toLowerCase().includes(kw)))
    .map((col) => col.title);
    
  if (cols.length === 0) {
    cols = schema.columns.filter((col) => col.type === 'numbers').map((col) => col.title);
  }
  
  return cols;
}

/**
 * Identifies which columns hold status/stage data.
 */
function findStatusColumns(schema) {
  const keywords = ['status', 'stage', 'state', 'phase', 'progress', 'pipeline'];
  
  const cols = schema.columns.filter((col) =>
    col.type === 'status' || col.type === 'color' ||
    keywords.some((kw) => col.title.toLowerCase().includes(kw))
  );

  // Sort to prioritize columns whose title contains stage-related keywords
  return cols.sort((a, b) => {
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();
    
    // Exact match for stage/status gets highest priority
    if (aTitle === 'stage' || aTitle === 'status') return -1;
    if (bTitle === 'stage' || bTitle === 'status') return 1;
    
    const aHasKw = keywords.some(kw => aTitle.includes(kw));
    const bHasKw = keywords.some(kw => bTitle.includes(kw));
    
    if (aHasKw && !bHasKw) return -1;
    if (!aHasKw && bHasKw) return 1;
    return 0;
  }).map((col) => col.title);
}

/**
 * Identifies which columns hold sector/industry data.
 */
function findSectorColumns(schema) {
  const keywords = ['sector', 'industry', 'vertical', 'segment', 'domain', 'category'];
  return schema.columns
    .filter((col) => keywords.some((kw) => col.title.toLowerCase().includes(kw)))
    .map((col) => col.title);
}

/**
 * Identifies date columns.
 */
function findDateColumns(schema) {
  const keywords = ['date', 'deadline', 'due', 'start', 'end', 'created', 'delivery', 'completion', 'close'];
  return schema.columns
    .filter((col) =>
      col.type === 'date' || col.type === 'timeline' ||
      keywords.some((kw) => col.title.toLowerCase().includes(kw))
    )
    .map((col) => col.title);
}

/**
 * Safely sums numeric values from records, skipping nulls.
 */
function safeSum(records, field) {
  return records.reduce((sum, r) => {
    const val = typeof r[field] === 'number' ? r[field] : parseFloat(r[field]);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
}

/**
 * Safely averages numeric values from records, skipping nulls.
 */
function safeAverage(records, field) {
  const validRecords = records.filter((r) => {
    const val = typeof r[field] === 'number' ? r[field] : parseFloat(r[field]);
    return !isNaN(val);
  });
  if (validRecords.length === 0) return 0;
  return safeSum(validRecords, field) / validRecords.length;
}

/**
 * Counts records by a categorical field value.
 */
function countBy(records, field) {
  const counts = {};
  for (const r of records) {
    const val = r[field] || 'Unknown';
    counts[val] = (counts[val] || 0) + 1;
  }
  return counts;
}

/**
 * Sums a numeric field grouped by a categorical field.
 */
function sumBy(records, numericField, groupField) {
  const sums = {};
  for (const r of records) {
    const group = r[groupField] || 'Unknown';
    const val = typeof r[numericField] === 'number' ? r[numericField] : parseFloat(r[numericField]);
    if (!isNaN(val)) {
      sums[group] = (sums[group] || 0) + val;
    }
  }
  return sums;
}

/**
 * Filters records that fall within a date range.
 *
 * @param {Object[]} records - Cleaned records
 * @param {string} dateField - Column title containing dates
 * @param {string|null} startDate - ISO date string (inclusive)
 * @param {string|null} endDate - ISO date string (inclusive)
 * @returns {Object[]} Filtered records
 */
function filterByDateRange(records, dateField, startDate, endDate) {
  return records.filter((r) => {
    const date = r[dateField];
    if (!date) return false;
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    return true;
  });
}

/**
 * Filters records by sector.
 */
function filterBySector(records, sectorField, sector) {
  if (!sector) return records;
  const normalized = sector.toLowerCase();
  return records.filter((r) => {
    const val = (r[sectorField] || '').toLowerCase();
    return val === normalized || val.includes(normalized) || normalized.includes(val);
  });
}

/**
 * Calculates deal pipeline metrics.
 *
 * @param {Object[]} deals - Cleaned deal records
 * @param {Object} schema - Deals board schema
 * @returns {Object} Pipeline metrics
 */
function calculatePipelineMetrics(deals, schema) {
  const statusCols = findStatusColumns(schema);
  const currencyCols = findCurrencyColumns(schema);
  const statusCol = statusCols[0] || null;
  const valueCol = currencyCols[0] || null;

  if (!statusCol) {
    return { error: 'No status column found in deals board', stages: {} };
  }

  const stageDistribution = countBy(deals, statusCol);
  const stageValues = valueCol ? sumBy(deals, valueCol, statusCol) : {};

  // Pipeline stage probability weights for weighted pipeline
  const STAGE_WEIGHTS = {
    'Lead': 0.10,
    'Qualified': 0.20,
    'Proposal': 0.40,
    'Negotiation': 0.60,
    'Verbal Commitment': 0.80,
    'Closed Won': 1.00,
    'Closed Lost': 0.00,
    'New': 0.05,
    'Pending': 0.15,
    'In Progress': 0.50,
  };

  const stages = {};
  let totalPipelineValue = 0;
  let weightedPipelineValue = 0;
  let missingValueCount = 0;
  
  if (valueCol) {
    for (const deal of deals) {
      const val = typeof deal[valueCol] === 'number' ? deal[valueCol] : parseFloat(deal[valueCol]);
      if (isNaN(val) || val === 0 || deal[valueCol] === null) {
        missingValueCount++;
      }
    }
  } else {
    missingValueCount = deals.length;
  }

  for (const [stage, count] of Object.entries(stageDistribution)) {
    const value = stageValues[stage] || 0;
    const weight = STAGE_WEIGHTS[stage] !== undefined ? STAGE_WEIGHTS[stage] : 0.25;

    stages[stage] = {
      count,
      value,
      weight,
      weightedValue: value * weight,
    };

    totalPipelineValue += value;
    weightedPipelineValue += value * weight;
  }

  return {
    totalDeals: deals.length,
    totalPipelineValue,
    weightedPipelineValue,
    stages,
    statusColumn: statusCol,
    valueColumn: valueCol,
    missingValueCount,
  };
}

/**
 * Calculates win/loss metrics for deals.
 */
function calculateWinLossMetrics(deals, schema) {
  const statusCols = findStatusColumns(schema);
  const currencyCols = findCurrencyColumns(schema);
  const statusCol = statusCols[0];
  const valueCol = currencyCols[0];

  if (!statusCol) return { winRate: 0, totalClosed: 0 };

  const closedWon = deals.filter((d) => {
    const status = (d[statusCol] || '').toLowerCase();
    return status === 'closed won' || status === 'won' || status === 'completed';
  });

  const closedLost = deals.filter((d) => {
    const status = (d[statusCol] || '').toLowerCase();
    return status === 'closed lost' || status === 'lost' || status === 'rejected';
  });

  const totalClosed = closedWon.length + closedLost.length;
  const winRate = totalClosed > 0 ? (closedWon.length / totalClosed) * 100 : 0;

  const wonRevenue = valueCol ? safeSum(closedWon, valueCol) : 0;
  const lostRevenue = valueCol ? safeSum(closedLost, valueCol) : 0;
  const avgDealSize = closedWon.length > 0 && valueCol ? wonRevenue / closedWon.length : 0;

  return {
    winRate: Math.round(winRate * 10) / 10,
    totalClosed,
    closedWon: closedWon.length,
    closedLost: closedLost.length,
    wonRevenue,
    lostRevenue,
    avgDealSize,
  };
}

/**
 * Calculates sector-level performance metrics.
 */
function calculateSectorMetrics(records, schema, boardType) {
  const sectorCols = findSectorColumns(schema);
  const currencyCols = findCurrencyColumns(schema);
  const sectorCol = sectorCols[0];
  const valueCol = currencyCols[0];

  if (!sectorCol) {
    return { error: 'No sector column found', sectors: {} };
  }

  const sectorCounts = countBy(records, sectorCol);
  const sectorValues = valueCol ? sumBy(records, valueCol, sectorCol) : {};

  const sectors = {};
  const totalValue = valueCol ? safeSum(records, valueCol) : 0;

  for (const [sector, count] of Object.entries(sectorCounts)) {
    const value = sectorValues[sector] || 0;
    sectors[sector] = {
      count,
      value,
      percentage: totalValue > 0 ? Math.round((value / totalValue) * 1000) / 10 : 0,
    };
  }

  // Sort by value descending
  const sorted = Object.entries(sectors)
    .sort(([, a], [, b]) => b.value - a.value)
    .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});

  return {
    totalSectors: Object.keys(sectors).length,
    totalValue,
    sectorColumn: sectorCol,
    sectors: sorted,
  };
}

/**
 * Calculates work order operational metrics.
 */
function calculateOperationalMetrics(workOrders, schema) {
  const statusCols = findStatusColumns(schema);
  const dateCols = findDateColumns(schema);
  const statusCol = statusCols[0];

  if (!statusCol) return { error: 'No status column found in work orders board' };

  const statusDistribution = countBy(workOrders, statusCol);

  const completed = workOrders.filter((wo) => {
    const status = (wo[statusCol] || '').toLowerCase();
    return status === 'completed' || status === 'done' || status === 'delivered' || status === 'closed won';
  });

  const inProgress = workOrders.filter((wo) => {
    const status = (wo[statusCol] || '').toLowerCase();
    return status === 'in progress' || status === 'active' || status === 'wip' || status === 'ongoing' || status === 'execution';
  });

  const completionRate = workOrders.length > 0
    ? Math.round((completed.length / workOrders.length) * 1000) / 10
    : 0;

  return {
    totalWorkOrders: workOrders.length,
    completedCount: completed.length,
    inProgressCount: inProgress.length,
    completionRate,
    statusDistribution,
    statusColumn: statusCol,
  };
}

module.exports = {
  findCurrencyColumns,
  findStatusColumns,
  findSectorColumns,
  findDateColumns,
  safeSum,
  safeAverage,
  countBy,
  sumBy,
  filterByDateRange,
  filterBySector,
  calculatePipelineMetrics,
  calculateWinLossMetrics,
  calculateSectorMetrics,
  calculateOperationalMetrics,
};
