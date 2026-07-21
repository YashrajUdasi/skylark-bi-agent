/**
 * Data Normalizer
 * 
 * Specialized normalization functions for handling messy real-world data.
 * Each function handles multiple format variations and edge cases,
 * returning a canonical form or null for unparseable values.
 */

/**
 * Common date format patterns encountered in messy data.
 * Ordered from most specific to least to avoid ambiguous parsing.
 */
const DATE_PATTERNS = [
  // ISO 8601 (already clean)
  { regex: /^(\d{4})-(\d{2})-(\d{2})/, parse: (m) => ({ year: +m[1], month: +m[2], day: +m[3] }) },
  // US format: MM/DD/YYYY or MM-DD-YYYY
  { regex: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, parse: (m) => ({ month: +m[1], day: +m[2], year: +m[3] }) },
  // EU format: DD.MM.YYYY
  { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, parse: (m) => ({ day: +m[1], month: +m[2], year: +m[3] }) },
  // Short year: MM/DD/YY or DD/MM/YY (ambiguous — we assume MM/DD/YY)
  { regex: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/, parse: (m) => {
    const year = +m[3] > 50 ? 1900 + +m[3] : 2000 + +m[3];
    return { month: +m[1], day: +m[2], year };
  }},
  // Written format: "Jan 15, 2024" or "January 15, 2024"
  { regex: /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/, parse: (m) => ({
    month: parseMonthName(m[1]),
    day: +m[2],
    year: +m[3],
  })},
  // Written format: "15 Jan 2024" or "15 January 2024"
  { regex: /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/, parse: (m) => ({
    day: +m[1],
    month: parseMonthName(m[2]),
    year: +m[3],
  })},
  // YYYY/MM/DD
  { regex: /^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/, parse: (m) => ({ year: +m[1], month: +m[2], day: +m[3] }) },
];

const MONTH_NAMES = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Parses a month name string into a number (1-12).
 * @param {string} name - Month name (full or abbreviated)
 * @returns {number} Month number (1-12) or 0 if unrecognized
 */
function parseMonthName(name) {
  return MONTH_NAMES[name.toLowerCase()] || 0;
}

/**
 * Normalizes a date value from any common format to ISO 8601 (YYYY-MM-DD).
 * Returns null for unparseable or empty values.
 *
 * @param {string|null|undefined} value - Raw date string
 * @returns {{ normalized: string|null, original: string, confidence: 'high'|'medium'|'low' }}
 */
function normalizeDate(value) {
  if (!value || typeof value !== 'string') {
    return { normalized: null, original: String(value || ''), confidence: 'low' };
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed === 'N/A' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'tbd') {
    return { normalized: null, original: trimmed, confidence: 'low' };
  }

  // Try to parse as a JavaScript Date first (handles ISO strings with time)
  const jsDate = new Date(trimmed);
  if (!isNaN(jsDate.getTime()) && trimmed.includes('-') && trimmed.length >= 10) {
    const iso = jsDate.toISOString().split('T')[0];
    return { normalized: iso, original: trimmed, confidence: 'high' };
  }

  // Try each pattern
  for (const pattern of DATE_PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      const parts = pattern.parse(match);
      if (parts.month >= 1 && parts.month <= 12 && parts.day >= 1 && parts.day <= 31 && parts.year >= 1900 && parts.year <= 2100) {
        const iso = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
        // Validate the constructed date
        const check = new Date(iso);
        if (!isNaN(check.getTime())) {
          return { normalized: iso, original: trimmed, confidence: 'high' };
        }
      }
    }
  }

  // Last resort: try JavaScript Date parser
  const lastResort = new Date(trimmed);
  if (!isNaN(lastResort.getTime())) {
    return {
      normalized: lastResort.toISOString().split('T')[0],
      original: trimmed,
      confidence: 'medium',
    };
  }

  return { normalized: null, original: trimmed, confidence: 'low' };
}

/**
 * Normalizes a currency/monetary value to a plain number.
 * Handles ₹, $, commas, lakhs formatting, and various notations.
 *
 * @param {string|number|null|undefined} value - Raw currency value
 * @returns {{ normalized: number|null, original: string, currency: string|null }}
 */
function normalizeCurrency(value) {
  if (value === null || value === undefined) {
    return { normalized: null, original: '', currency: null };
  }

  // Already a number
  if (typeof value === 'number' && !isNaN(value)) {
    return { normalized: value, original: String(value), currency: null };
  }

  const str = String(value).trim();
  if (!str || str === '-' || str === 'N/A' || str.toLowerCase() === 'null' || str.toLowerCase() === 'tbd') {
    return { normalized: null, original: str, currency: null };
  }

  // Detect currency symbol
  let currency = null;
  if (str.includes('₹') || str.toLowerCase().includes('inr')) currency = 'INR';
  else if (str.includes('$') || str.toLowerCase().includes('usd')) currency = 'USD';
  else if (str.includes('€') || str.toLowerCase().includes('eur')) currency = 'EUR';

  // Handle multiplier suffixes: "10L", "10 Lacs", "10 Lakhs", "1Cr", "1M", "1K"
  let multiplier = 1;
  const lowerStr = str.toLowerCase();
  if (/\d+\s*(cr|crore|crores)\b/i.test(str)) {
    multiplier = 10000000;
  } else if (/\d+\s*(l|lac|lacs|lakh|lakhs)\b/i.test(str)) {
    multiplier = 100000;
  } else if (/\d+\s*(m|mn|million)\b/i.test(str)) {
    multiplier = 1000000;
  } else if (/\d+\s*(k|thousand)\b/i.test(str)) {
    multiplier = 1000;
  }

  // Remove currency symbols, letters, and extract number
  let numStr = str
    .replace(/[₹$€]/g, '')
    .replace(/[A-Za-z]/g, '')
    .replace(/\s/g, '')
    .trim();

  // Handle Indian lakhs formatting: 1,00,000 → 100000
  // Indian format has groups of 2 after the first 3: 1,00,00,000
  if (/^\d{1,2}(,\d{2})*(,\d{3})$/.test(numStr) || /^\d{1,2}(,\d{2})+$/.test(numStr)) {
    numStr = numStr.replace(/,/g, '');
  } else {
    // Standard Western comma removal: 1,000,000 → 1000000
    numStr = numStr.replace(/,/g, '');
  }

  const num = parseFloat(numStr);
  if (isNaN(num)) {
    return { normalized: null, original: str, currency };
  }

  return {
    normalized: num * multiplier,
    original: str,
    currency: currency || 'INR', // Default to INR for Skylark (Indian drone company)
  };
}

/**
 * Canonical sector mappings for Skylark Drones' verticals.
 * Maps common variations to a standard sector name.
 */
const SECTOR_MAPPINGS = {
  // Energy sector
  'energy': 'Energy',
  'energy sector': 'Energy',
  'power': 'Energy',
  'power sector': 'Energy',
  'solar': 'Energy',
  'wind': 'Energy',
  'renewable': 'Energy',
  'renewables': 'Energy',
  'oil & gas': 'Energy',
  'oil and gas': 'Energy',
  'o&g': 'Energy',
  'thermal': 'Energy',
  'thermal power': 'Energy',

  // Mining
  'mining': 'Mining',
  'mines': 'Mining',
  'mine': 'Mining',
  'quarry': 'Mining',
  'coal': 'Mining',
  'mineral': 'Mining',

  // Construction & Infrastructure
  'construction': 'Construction',
  'infrastructure': 'Infrastructure',
  'infra': 'Infrastructure',
  'real estate': 'Infrastructure',
  'realty': 'Infrastructure',
  'highways': 'Infrastructure',
  'roads': 'Infrastructure',

  // Agriculture
  'agriculture': 'Agriculture',
  'agri': 'Agriculture',
  'farming': 'Agriculture',
  'farm': 'Agriculture',
  'crop': 'Agriculture',

  // Telecom
  'telecom': 'Telecom',
  'telecommunications': 'Telecom',
  'telco': 'Telecom',
  'tower': 'Telecom',

  // Government / Defense
  'government': 'Government',
  'govt': 'Government',
  'defense': 'Defense',
  'defence': 'Defense',
  'military': 'Defense',

  // Industrial
  'industrial': 'Industrial',
  'manufacturing': 'Industrial',
  'factory': 'Industrial',
  'plant': 'Industrial',

  // Surveying & Mapping
  'survey': 'Surveying',
  'surveying': 'Surveying',
  'mapping': 'Surveying',
  'gis': 'Surveying',
  'geospatial': 'Surveying',

  // Urban / Smart City
  'urban': 'Urban Development',
  'smart city': 'Urban Development',
  'city': 'Urban Development',
  'municipal': 'Urban Development',

  // Others
  'other': 'Other',
  'others': 'Other',
  'miscellaneous': 'Other',
  'misc': 'Other',
  'na': 'Other',
  'n/a': 'Other',
};

/**
 * Normalizes a sector/industry name to a canonical form.
 * Uses fuzzy matching via the SECTOR_MAPPINGS table.
 *
 * @param {string|null|undefined} value - Raw sector string
 * @returns {{ normalized: string, original: string, matched: boolean }}
 */
function normalizeSector(value) {
  if (!value || typeof value !== 'string') {
    return { normalized: 'Unknown', original: String(value || ''), matched: false };
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'null') {
    return { normalized: 'Unknown', original: trimmed, matched: false };
  }

  const lower = trimmed.toLowerCase().replace(/[^a-z0-9\s&]/g, '').trim();

  // Direct lookup
  if (SECTOR_MAPPINGS[lower]) {
    return { normalized: SECTOR_MAPPINGS[lower], original: trimmed, matched: true };
  }

  // Partial match — check if any key is contained in the value
  for (const [key, canonical] of Object.entries(SECTOR_MAPPINGS)) {
    if (lower.includes(key) || key.includes(lower)) {
      return { normalized: canonical, original: trimmed, matched: true };
    }
  }

  // No match — return original with title case
  const titleCased = trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
  return { normalized: titleCased, original: trimmed, matched: false };
}

/**
 * Status canonicalization mappings.
 */
const STATUS_MAPPINGS = {
  // Active/In Progress
  'in progress': 'In Progress',
  'in-progress': 'In Progress',
  'inprogress': 'In Progress',
  'wip': 'In Progress',
  'working': 'In Progress',
  'ongoing': 'In Progress',
  'active': 'In Progress',
  'started': 'In Progress',
  'executing': 'In Progress',
  'execution': 'In Progress',

  // Completed/Done
  'completed': 'Completed',
  'complete': 'Completed',
  'done': 'Completed',
  'finished': 'Completed',
  'delivered': 'Completed',
  'closed': 'Completed',
  'closed won': 'Closed Won',
  'won': 'Closed Won',

  // Lost
  'closed lost': 'Closed Lost',
  'lost': 'Closed Lost',
  'rejected': 'Closed Lost',
  'declined': 'Closed Lost',

  // Pending/New
  'pending': 'Pending',
  'new': 'New',
  'open': 'New',
  'not started': 'Not Started',
  'not-started': 'Not Started',
  'notstarted': 'Not Started',
  'to do': 'Not Started',
  'todo': 'Not Started',
  'backlog': 'Not Started',

  // Pipeline stages (deals)
  'lead': 'Lead',
  'prospect': 'Lead',
  'qualified': 'Qualified',
  'proposal': 'Proposal',
  'proposal sent': 'Proposal',
  'negotiation': 'Negotiation',
  'negotiating': 'Negotiation',
  'contract': 'Negotiation',
  'verbal': 'Verbal Commitment',
  'verbal commitment': 'Verbal Commitment',
  'committed': 'Verbal Commitment',

  // On Hold / Stuck
  'on hold': 'On Hold',
  'hold': 'On Hold',
  'paused': 'On Hold',
  'stuck': 'Stuck',
  'blocked': 'Stuck',

  // Cancelled
  'cancelled': 'Cancelled',
  'canceled': 'Cancelled',
  'dropped': 'Cancelled',
  'abandoned': 'Cancelled',
};

/**
 * Normalizes a status value to a canonical form.
 *
 * @param {string|null|undefined} value - Raw status string
 * @returns {{ normalized: string, original: string, matched: boolean }}
 */
function normalizeStatus(value) {
  if (!value || typeof value !== 'string') {
    return { normalized: 'Unknown', original: String(value || ''), matched: false };
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'null') {
    return { normalized: 'Unknown', original: trimmed, matched: false };
  }

  const lower = trimmed.toLowerCase().trim();

  if (STATUS_MAPPINGS[lower]) {
    return { normalized: STATUS_MAPPINGS[lower], original: trimmed, matched: true };
  }

  // Partial match
  for (const [key, canonical] of Object.entries(STATUS_MAPPINGS)) {
    if (lower.includes(key) || key.includes(lower)) {
      return { normalized: canonical, original: trimmed, matched: true };
    }
  }

  // Return original with title case
  const titleCased = trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
  return { normalized: titleCased, original: trimmed, matched: false };
}

/**
 * Normalizes a general text value.
 * Trims whitespace, normalizes case, handles common junk values.
 *
 * @param {string|null|undefined} value - Raw text
 * @returns {string|null} Cleaned text or null
 */
function normalizeText(value) {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();

  // Handle common null-like values
  const lower = trimmed.toLowerCase();
  if (!trimmed || lower === 'null' || lower === 'n/a' || lower === 'na' ||
      lower === 'none' || lower === '-' || lower === '--' || lower === 'undefined' ||
      lower === 'tbd' || lower === 'tba') {
    return null;
  }

  // Normalize excessive whitespace
  return trimmed.replace(/\s+/g, ' ');
}

/**
 * Normalizes a numeric value (non-currency).
 * Handles percentage signs, commas, and various numeric formats.
 *
 * @param {string|number|null|undefined} value - Raw numeric value
 * @returns {number|null} Parsed number or null
 */
function normalizeNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;

  const str = String(value).trim();
  if (!str || str === '-' || str.toLowerCase() === 'null' || str.toLowerCase() === 'n/a') {
    return null;
  }

  // Remove percentage sign and common suffixes
  let cleaned = str.replace(/%/g, '').replace(/,/g, '').trim();

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

module.exports = {
  normalizeDate,
  normalizeCurrency,
  normalizeSector,
  normalizeStatus,
  normalizeText,
  normalizeNumber,
  SECTOR_MAPPINGS,
  STATUS_MAPPINGS,
};
