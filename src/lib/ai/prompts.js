/**
 * AI System Prompts
 * 
 * Defines the system prompt and context for the AI reasoning pipeline.
 * The system prompt is critical — it shapes how the AI interprets queries,
 * uses tools, and communicates results.
 */

/**
 * Builds the system prompt with dynamic board schema context.
 *
 * @param {Object|null} boardSchemas - Schema info from getBoardSchemas()
 * @returns {string} The complete system prompt
 */
function buildSystemPrompt(boardSchemas = null) {
  let schemaContext = '';

  if (boardSchemas) {
    const formatColumns = (cols) =>
      cols.map((c) => `  - "${c.title}" (${c.type})`).join('\n');

    schemaContext = `

## Available Data

### Board 1: ${boardSchemas.workOrders?.name || 'Work Orders'}
Columns:
${formatColumns(boardSchemas.workOrders?.columns || [])}

### Board 2: ${boardSchemas.deals?.name || 'Deals'}
Columns:
${formatColumns(boardSchemas.deals?.columns || [])}
`;
  }

  return `You are a BI analyst AI for Skylark Drones. Answer business questions using tools to query live Monday.com data (Work Orders + Deals boards).

## Rules
- ALWAYS call a tool first. Never invent numbers.
- Use get_dashboard_summary for broad overview questions.
- Use get_pipeline_analysis for pipeline/stage/deal questions.
- Use get_sector_analysis for sector breakdowns.
- Use query_deals or query_work_orders with filters for specific queries.

## Accuracy Rules
- DO NOT say "this quarter" unless you explicitly filtered by dates. Say "current pipeline snapshot" instead.
- If missingValueCount > 0, always report: "X deals are missing values; actual total may be higher."
- If you see a stage column showing owner names (OWNER_001, etc.), use the next available status-type column instead.
- Flag "New" as an uncategorized placeholder, not a real sector.

## Format
- Lead with the key number. Then bullet points with context.
- Report money in USD ($) with B/M suffixes (e.g. $2.31B).
- Be concise — under 300 words unless asked for a full report.`;
}

/**
 * Returns a concise system prompt for when schemas aren't yet available.
 */
function getMinimalSystemPrompt() {
  return buildSystemPrompt(null);
}

module.exports = {
  buildSystemPrompt,
  getMinimalSystemPrompt,
};
