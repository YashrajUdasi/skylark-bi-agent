/**
 * AI Function Calling Tools
 * 
 * Defines the tools (functions) that GPT-4 can call to query data.
 * Each tool maps to a function in the analytics engine.
 * 
 * Tools use strict mode for reliable structured argument parsing.
 */

/**
 * Tool definitions for OpenAI function calling.
 * Each tool has a name, description, and JSON Schema for parameters.
 */
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_dashboard_summary',
      description: 'Get a comprehensive dashboard summary with all KPIs including total deals, work orders, pipeline value, win rate, sector breakdowns, and operational metrics. Use this for broad overview questions.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_work_orders',
      description: 'Query work orders (project execution data) with optional filters by sector, status, date range, or limit. Returns work order records with project details, statuses, and values.',
      parameters: {
        type: 'object',
        properties: {
          sector: {
            type: ['string', 'null'],
            description: 'Filter by sector/industry (e.g., "Energy", "Mining", "Construction")',
          },
          status: {
            type: ['string', 'null'],
            description: 'Filter by status (e.g., "In Progress", "Completed", "Pending")',
          },
          start_date: {
            type: ['string', 'null'],
            description: 'Filter by start date in ISO format (YYYY-MM-DD)',
          },
          end_date: {
            type: ['string', 'null'],
            description: 'Filter by end date in ISO format (YYYY-MM-DD)',
          },
          limit: {
            type: ['number', 'null'],
            description: 'Maximum number of records to return (default: all)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_deals',
      description: 'Query deals (sales pipeline data) with optional filters by sector, stage/status, date range, or limit. Returns deal records with values, stages, and client details.',
      parameters: {
        type: 'object',
        properties: {
          sector: {
            type: ['string', 'null'],
            description: 'Filter by sector/industry (e.g., "Energy", "Mining", "Construction")',
          },
          status: {
            type: ['string', 'null'],
            description: 'Filter by pipeline stage (e.g., "Lead", "Proposal", "Negotiation", "Closed Won", "Closed Lost")',
          },
          start_date: {
            type: ['string', 'null'],
            description: 'Filter by start date in ISO format (YYYY-MM-DD)',
          },
          end_date: {
            type: ['string', 'null'],
            description: 'Filter by end date in ISO format (YYYY-MM-DD)',
          },
          limit: {
            type: ['number', 'null'],
            description: 'Maximum number of records to return (default: all)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pipeline_analysis',
      description: 'Get detailed pipeline analysis showing deal stages, values, conversion rates, and win/loss metrics. Optionally filter by sector or date range.',
      parameters: {
        type: 'object',
        properties: {
          sector: {
            type: ['string', 'null'],
            description: 'Filter pipeline by sector (e.g., "Energy")',
          },
          start_date: {
            type: ['string', 'null'],
            description: 'Start date filter (YYYY-MM-DD)',
          },
          end_date: {
            type: ['string', 'null'],
            description: 'End date filter (YYYY-MM-DD)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_revenue_metrics',
      description: 'Get revenue and financial metrics including total deal values, average deal size, revenue by sector, and work order values.',
      parameters: {
        type: 'object',
        properties: {
          sector: {
            type: ['string', 'null'],
            description: 'Filter by sector',
          },
          start_date: {
            type: ['string', 'null'],
            description: 'Start date filter (YYYY-MM-DD)',
          },
          end_date: {
            type: ['string', 'null'],
            description: 'End date filter (YYYY-MM-DD)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sector_analysis',
      description: 'Get performance analysis broken down by sector/industry. Shows deal counts, values, and work order counts per sector across both boards.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_across_boards',
      description: 'Search for records across both Work Orders and Deals boards by a text query. Useful for finding specific clients, projects, or items.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search text to find in records',
          },
          limit: {
            type: ['number', 'null'],
            description: 'Maximum number of results (default: 20)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_data_quality_report',
      description: 'Get a data quality report showing completeness, normalization stats, and data issues for both boards. Use when the user asks about data reliability or when you need to caveat your analysis.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_board_schemas',
      description: 'Get the column structure of both boards (Work Orders and Deals). Use this to understand what data fields are available before querying.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_leadership_update',
      description: 'Generate a structured leadership update / executive summary covering pipeline health, revenue performance, sector analysis, operational highlights, and recommendations. Use this when the user asks for a leadership update, board meeting summary, or executive report.',
      parameters: {
        type: 'object',
        properties: {
          focus_areas: {
            type: ['string', 'null'],
            description: 'Optional comma-separated list of areas to focus on (e.g., "pipeline,revenue,energy sector")',
          },
        },
      },
    },
  },
];

module.exports = { TOOLS };
