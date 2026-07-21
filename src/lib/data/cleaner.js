/**
 * Data Cleaning Engine
 * 
 * Orchestrates the data cleaning pipeline. Takes raw records from Monday.com
 * and produces cleaned, normalized data with a quality report.
 * 
 * The engine dynamically discovers column types from the board schema
 * and applies appropriate normalization for each column type.
 */

const {
  normalizeDate,
  normalizeCurrency,
  normalizeSector,
  normalizeStatus,
  normalizeText,
  normalizeNumber,
} = require('./normalizer');

/**
 * Column type classification for automatic normalizer selection.
 * Maps Monday.com column types and title keywords to normalizer functions.
 */
const COLUMN_CLASSIFIERS = {
  // Monday.com column types that are dates
  dateTypes: ['date', 'timeline', 'creation_log', 'last_updated'],

  // Monday.com column types that are numeric
  numericTypes: ['numbers', 'formula', 'rating'],

  // Monday.com column types that are statuses
  statusTypes: ['status', 'color'],

  // Title keywords that suggest a date column
  dateTitleKeywords: ['date', 'deadline', 'due', 'start', 'end', 'created', 'updated', 'delivery', 'completion', 'close'],

  // Title keywords that suggest a currency/revenue column
  currencyTitleKeywords: ['revenue', 'amount', 'value', 'price', 'cost', 'total', 'deal value', 'contract', 'budget', 'payment', 'invoice', 'billing', 'fee'],

  // Title keywords that suggest a sector/industry column
  sectorTitleKeywords: ['sector', 'industry', 'vertical', 'segment', 'domain', 'category'],

  // Title keywords that suggest a status column
  statusTitleKeywords: ['status', 'stage', 'state', 'phase', 'progress', 'pipeline'],
};

/**
 * Determines the normalizer function to use for a given column.
 *
 * @param {Object} column - Column definition from schema { id, title, type }
 * @returns {'date'|'currency'|'sector'|'status'|'number'|'text'} Normalizer type
 */
function classifyColumn(column) {
  const type = (column.type || '').toLowerCase();
  const title = (column.title || '').toLowerCase();

  // Check by Monday.com column type first
  if (COLUMN_CLASSIFIERS.dateTypes.includes(type)) return 'date';
  if (COLUMN_CLASSIFIERS.numericTypes.includes(type)) return 'number';
  if (COLUMN_CLASSIFIERS.statusTypes.includes(type)) return 'status';

  // Check by column title keywords
  if (COLUMN_CLASSIFIERS.dateTitleKeywords.some((kw) => title.includes(kw))) return 'date';
  if (COLUMN_CLASSIFIERS.currencyTitleKeywords.some((kw) => title.includes(kw))) return 'currency';
  if (COLUMN_CLASSIFIERS.sectorTitleKeywords.some((kw) => title.includes(kw))) return 'sector';
  if (COLUMN_CLASSIFIERS.statusTitleKeywords.some((kw) => title.includes(kw))) return 'status';

  // Default to text normalization
  return 'text';
}

/**
 * Applies the appropriate normalizer to a value based on the column classification.
 *
 * @param {*} value - Raw value
 * @param {'date'|'currency'|'sector'|'status'|'number'|'text'} classification - Column type
 * @returns {{ value: *, normalized: boolean, meta: Object|null }}
 */
function normalizeValue(value, classification) {
  switch (classification) {
    case 'date': {
      const result = normalizeDate(value);
      return {
        value: result.normalized,
        normalized: result.normalized !== null,
        meta: { originalDate: result.original, confidence: result.confidence },
      };
    }
    case 'currency': {
      const result = normalizeCurrency(value);
      return {
        value: result.normalized,
        normalized: result.normalized !== null,
        meta: { originalCurrency: result.original, currency: result.currency },
      };
    }
    case 'sector': {
      const result = normalizeSector(value);
      return {
        value: result.normalized,
        normalized: result.matched,
        meta: { originalSector: result.original },
      };
    }
    case 'status': {
      const result = normalizeStatus(value);
      return {
        value: result.normalized,
        normalized: result.matched,
        meta: { originalStatus: result.original },
      };
    }
    case 'number': {
      const result = normalizeNumber(value);
      return {
        value: result,
        normalized: result !== null,
        meta: null,
      };
    }
    case 'text':
    default: {
      const result = normalizeText(value);
      return {
        value: result,
        normalized: result !== null && result !== value,
        meta: null,
      };
    }
  }
}

/**
 * Cleans and normalizes all records from a board.
 * This is the main cleaning pipeline entry point.
 *
 * @param {Object[]} records - Raw records from the fetcher
 * @param {Object} schema - Board schema with column definitions
 * @returns {{ cleanedRecords: Object[], qualityReport: Object }}
 */
function cleanBoardData(records, schema) {
  if (!records || records.length === 0) {
    return {
      cleanedRecords: [],
      qualityReport: createEmptyQualityReport(schema),
    };
  }

  // Classify all columns
  const columnClassifications = {};
  for (const col of schema.columns) {
    columnClassifications[col.title] = classifyColumn(col);
  }

  // Track quality metrics
  const quality = {
    totalRecords: records.length,
    totalFields: 0,
    nullFields: 0,
    normalizedFields: 0,
    failedNormalizations: 0,
    columnStats: {},
    dataIssues: [],
  };

  // Initialize column stats
  for (const col of schema.columns) {
    quality.columnStats[col.title] = {
      type: columnClassifications[col.title],
      totalValues: 0,
      nullValues: 0,
      normalizedValues: 0,
      uniqueValues: new Set(),
      sampleIssues: [],
    };
  }

  // Process each record
  const cleanedRecords = records.map((record, index) => {
    const cleaned = {
      _itemId: record._itemId,
      _itemName: normalizeText(record._itemName) || record._itemName,
      _groupId: record._groupId,
      _groupTitle: record._groupTitle,
      _createdAt: record._createdAt,
      _updatedAt: record._updatedAt,
      _recordIndex: index,
    };

    // Process each column
    for (const col of schema.columns) {
      const rawValue = record[col.title];
      const classification = columnClassifications[col.title];
      const stats = quality.columnStats[col.title];

      stats.totalValues++;
      quality.totalFields++;

      // Skip internal columns (start with _)
      if (col.title.startsWith('_')) continue;

      if (rawValue === null || rawValue === undefined || rawValue === '') {
        cleaned[col.title] = null;
        stats.nullValues++;
        quality.nullFields++;
      } else {
        const result = normalizeValue(rawValue, classification);
        cleaned[col.title] = result.value;

        if (result.value === null) {
          stats.nullValues++;
          quality.nullFields++;
        } else {
          stats.uniqueValues.add(String(result.value));
        }

        if (result.normalized) {
          stats.normalizedValues++;
          quality.normalizedFields++;
        }

        // Track issues (limit to 3 samples per column)
        if (!result.normalized && result.value !== null && rawValue !== result.value) {
          if (stats.sampleIssues.length < 3) {
            stats.sampleIssues.push({
              recordIndex: index,
              original: rawValue,
              cleaned: result.value,
            });
          }
        }
      }

      // Store raw value reference for debugging
      if (rawValue !== cleaned[col.title]) {
        cleaned[`_original_${col.title}`] = rawValue;
      }
    }

    return cleaned;
  });

  // Compile quality report
  const qualityReport = compileQualityReport(quality, schema);

  return { cleanedRecords, qualityReport };
}

/**
 * Compiles the final quality report from collected metrics.
 *
 * @param {Object} quality - Raw quality metrics
 * @param {Object} schema - Board schema
 * @returns {Object} Compiled quality report
 */
function compileQualityReport(quality, schema) {
  const columnReports = {};
  const issues = [];

  for (const [colTitle, stats] of Object.entries(quality.columnStats)) {
    const completeness = stats.totalValues > 0
      ? ((stats.totalValues - stats.nullValues) / stats.totalValues * 100).toFixed(1)
      : 0;

    columnReports[colTitle] = {
      type: stats.type,
      completeness: parseFloat(completeness),
      totalValues: stats.totalValues,
      nullValues: stats.nullValues,
      normalizedValues: stats.normalizedValues,
      uniqueValueCount: stats.uniqueValues.size,
      sampleIssues: stats.sampleIssues,
    };

    // Flag columns with high null rates (>50%)
    if (parseFloat(completeness) < 50 && stats.totalValues > 0) {
      issues.push({
        severity: 'warning',
        column: colTitle,
        message: `Column "${colTitle}" has ${completeness}% completeness (${stats.nullValues}/${stats.totalValues} values missing)`,
      });
    }

    // Flag columns with many normalization issues
    if (stats.sampleIssues.length >= 3) {
      issues.push({
        severity: 'info',
        column: colTitle,
        message: `Column "${colTitle}" has some values that couldn't be fully normalized`,
      });
    }
  }

  const overallCompleteness = quality.totalFields > 0
    ? ((quality.totalFields - quality.nullFields) / quality.totalFields * 100).toFixed(1)
    : 0;

  return {
    boardName: schema.name,
    boardId: schema.id,
    totalRecords: quality.totalRecords,
    totalFields: quality.totalFields,
    overallCompleteness: parseFloat(overallCompleteness),
    nullFields: quality.nullFields,
    normalizedFields: quality.normalizedFields,
    columns: columnReports,
    issues,
    qualityScore: calculateQualityScore(quality, issues),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Calculates an overall data quality score (0-100).
 *
 * @param {Object} quality - Raw quality metrics
 * @param {Object[]} issues - Detected issues
 * @returns {number} Quality score
 */
function calculateQualityScore(quality, issues) {
  if (quality.totalFields === 0) return 0;

  // Completeness contributes 60% of the score
  const completenessScore = ((quality.totalFields - quality.nullFields) / quality.totalFields) * 60;

  // Normalization success contributes 30%
  const normalizableFields = quality.totalFields - quality.nullFields;
  const normalizationScore = normalizableFields > 0
    ? (quality.normalizedFields / normalizableFields) * 30
    : 30;

  // Issue penalty: each warning reduces score by 2, each error by 5
  const issuePenalty = issues.reduce((penalty, issue) => {
    if (issue.severity === 'warning') return penalty + 2;
    if (issue.severity === 'error') return penalty + 5;
    return penalty + 1;
  }, 0);

  const score = Math.max(0, Math.min(100, completenessScore + normalizationScore + 10 - issuePenalty));
  return Math.round(score);
}

/**
 * Creates an empty quality report for boards with no records.
 */
function createEmptyQualityReport(schema) {
  return {
    boardName: schema.name,
    boardId: schema.id,
    totalRecords: 0,
    totalFields: 0,
    overallCompleteness: 0,
    nullFields: 0,
    normalizedFields: 0,
    columns: {},
    issues: [{ severity: 'warning', column: null, message: 'No records found on this board' }],
    qualityScore: 0,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Cleans data from both boards (work orders and deals).
 * Main entry point for the full data pipeline.
 *
 * @param {Object} allData - Output from fetchAllData()
 * @returns {{ workOrders: Object, deals: Object, overallQuality: Object }}
 */
function cleanAllData(allData) {
  const woResult = cleanBoardData(allData.workOrders.records, allData.workOrders.schema);
  const dealsResult = cleanBoardData(allData.deals.records, allData.deals.schema);

  const overallQuality = {
    workOrdersQuality: woResult.qualityReport,
    dealsQuality: dealsResult.qualityReport,
    overallScore: Math.round(
      (woResult.qualityReport.qualityScore + dealsResult.qualityReport.qualityScore) / 2
    ),
    totalRecords: woResult.qualityReport.totalRecords + dealsResult.qualityReport.totalRecords,
    allIssues: [
      ...woResult.qualityReport.issues.map((i) => ({ ...i, board: 'Work Orders' })),
      ...dealsResult.qualityReport.issues.map((i) => ({ ...i, board: 'Deals' })),
    ],
  };

  return {
    workOrders: {
      ...allData.workOrders,
      records: woResult.cleanedRecords,
      qualityReport: woResult.qualityReport,
    },
    deals: {
      ...allData.deals,
      records: dealsResult.cleanedRecords,
      qualityReport: dealsResult.qualityReport,
    },
    overallQuality,
    cleanedAt: new Date().toISOString(),
  };
}

module.exports = {
  cleanBoardData,
  cleanAllData,
  classifyColumn,
  normalizeValue,
  COLUMN_CLASSIFIERS,
};
