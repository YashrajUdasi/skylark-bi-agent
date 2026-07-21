/**
 * Column Mapper
 *
 * Maps actual Monday.com board column names (as seen in the CSV exports)
 * to the semantic roles used by the analytics engine.
 *
 * This replaces the fragile keyword-heuristic approach with explicit mappings
 * based on the real Skylark Drones board schemas.
 */

/**
 * Deals board column mappings (from "Deal funnel Data" CSV).
 */
const DEALS_COLUMN_MAP = {
  // The column containing the monetary deal value
  value: 'Masked Deal value',
  // The column containing the pipeline stage (e.g. "E. Proposal/Commercials Sent")
  stage: 'Deal Stage',
  // The column for sector/industry
  sector: 'Sector/service',
  // The column for deal open/closed status
  status: 'Deal Status',
  // The column for close date
  closeDate: 'Close Date (A)',
  // Created date
  createdDate: 'Created Date',
  // Tentative close date
  tentativeCloseDate: 'Tentative Close Date',
};

/**
 * Work Orders board column mappings (from "Work_Order_Tracker Data" CSV).
 */
const WORK_ORDERS_COLUMN_MAP = {
  // Primary value column (excl GST)
  value: 'Amount in Rupees (Excl of GST) (Masked)',
  // Billed value
  billedValue: 'Billed Value in Rupees (Excl of GST.) (Masked)',
  // Execution status (Completed, In Progress, etc.)
  status: 'Execution Status',
  // Sector
  sector: 'Sector',
  // WO Status (billed/collection)
  woStatus: 'WO Status (billed)',
  // Dates
  startDate: 'Probable Start Date',
  endDate: 'Probable End Date',
  deliveryDate: 'Data Delivery Date',
};

/**
 * Pipeline stage weights for weighted pipeline value calculation.
 * Based on the actual Skylark deal stages from the CSV.
 */
const STAGE_WEIGHTS = {
  'Lead': 0.05,
  'Proposal': 0.40,
  'D. Feasibility': 0.30,
  'On Hold': 0.10,
  'H. Work Order Received': 0.85,
  'Negotiation': 0.60,
  'Completed': 1.00,
  'Deal Stage': 0.00,
  'N. Not Relevant At The Moment': 0.00,
  'Closed Lost': 0.00,
  'O. Not Relevant At All': 0.00,
  'J. Invoice Sent': 1.00,
  'I. POC': 0.50,
  'Closed Won': 1.00,
  'K. Amount Accrued': 1.00,
};

/**
 * Stages that count as "Won" for win rate calculation.
 */
const WON_STAGES = ['Closed Won'];

/**
 * Stages that count as "Lost" for win rate calculation.
 */
const LOST_STAGES = ['Closed Lost'];

/**
 * Work order statuses considered "Completed".
 */
const COMPLETED_STATUSES = ['completed', 'executed until current month', 'closed'];

/**
 * Work order statuses considered "In Progress".
 */
const IN_PROGRESS_STATUSES = ['ongoing', 'in progress', 'not started', 'open'];

module.exports = {
  DEALS_COLUMN_MAP,
  WORK_ORDERS_COLUMN_MAP,
  STAGE_WEIGHTS,
  WON_STAGES,
  LOST_STAGES,
  COMPLETED_STATUSES,
  IN_PROGRESS_STATUSES,
};
