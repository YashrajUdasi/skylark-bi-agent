/**
 * AI Reasoning Pipeline
 * 
 * Implements the function-calling execution loop for GPT-4.
 * 
 * Flow:
 * 1. Receive user message
 * 2. Send to GPT-4 with tools + system prompt + board schemas
 * 3. If tool_calls returned → execute matching analytics function → return results
 * 4. Loop until GPT-4 produces a final text response
 * 5. Return the response (or stream it)
 */

const { getOpenAIClient, getModelName } = require('./openai-client');
const { TOOLS } = require('./tools');
const { buildSystemPrompt } = require('./prompts');
const {
  getDashboardSummary,
  queryWorkOrders,
  queryDeals,
  getPipelineAnalysis,
  getRevenueMetrics,
  getSectorAnalysis,
  getDataQualityReport,
  searchAcrossBoards,
  getBoardSchemas,
} = require('../analytics/engine');
const { generateLeadershipReport } = require('../report/generator');

/** Maximum number of tool-calling rounds to prevent infinite loops */
const MAX_TOOL_ROUNDS = 5;

/**
 * Executes a tool call by name, routing to the appropriate analytics function.
 *
 * @param {string} functionName - The tool/function name
 * @param {Object} args - The parsed arguments from GPT-4
 * @returns {Promise<Object>} The function result
 */
async function executeToolCall(functionName, args) {
  // Guard against null/undefined args from the model
  const safeArgs = args || {};
  try {
    switch (functionName) {
      case 'get_dashboard_summary':
        return await getDashboardSummary();

      case 'query_work_orders':
        return await queryWorkOrders({
          sector: safeArgs.sector || null,
          status: safeArgs.status || null,
          startDate: safeArgs.start_date || null,
          endDate: safeArgs.end_date || null,
          limit: safeArgs.limit || null,
        });

      case 'query_deals':
        return await queryDeals({
          sector: safeArgs.sector || null,
          status: safeArgs.status || null,
          startDate: safeArgs.start_date || null,
          endDate: safeArgs.end_date || null,
          limit: safeArgs.limit || null,
        });

      case 'get_pipeline_analysis':
        return await getPipelineAnalysis({
          sector: safeArgs.sector || null,
          startDate: safeArgs.start_date || null,
          endDate: safeArgs.end_date || null,
        });

      case 'get_revenue_metrics':
        return await getRevenueMetrics({
          sector: safeArgs.sector || null,
          startDate: safeArgs.start_date || null,
          endDate: safeArgs.end_date || null,
        });

      case 'get_sector_analysis':
        return await getSectorAnalysis();

      case 'search_across_boards':
        return await searchAcrossBoards(safeArgs.query || '', safeArgs.limit || 20);

      case 'get_data_quality_report':
        return await getDataQualityReport();

      case 'get_board_schemas':
        return await getBoardSchemas();

      case 'generate_leadership_update':
        return await generateLeadershipReport(safeArgs.focus_areas || null);

      default:
        return { error: `Unknown function: ${functionName}` };
    }
  } catch (err) {
    console.error(`[AI Reasoning] Tool call error for ${functionName}:`, err.message);
    return {
      error: `Failed to execute ${functionName}: ${err.message}`,
      suggestion: 'Try rephrasing your question or ask about a different metric.',
    };
  }
}

/**
 * Truncates tool results to stay within token limits.
 * For large datasets, it summarizes rather than sending all records.
 *
 * @param {Object} result - Raw tool result
 * @param {string} functionName - The tool name
 * @returns {string} JSON string, potentially truncated
 */
function truncateToolResult(result, functionName) {
  const json = JSON.stringify(result);

  // If result is small enough, return as-is
  if (json.length < 4000) return json;

  // For queries that return records, truncate the records array
  if (result.records && Array.isArray(result.records)) {
    const truncated = {
      ...result,
      records: result.records.slice(0, 5),
      _truncated: true,
      _totalRecords: result.records.length,
      _note: `Showing first 5 of ${result.records.length} records. Use filters to narrow results.`,
    };
    return JSON.stringify(truncated);
  }

  // For search results
  if (result.results && Array.isArray(result.results)) {
    const truncated = {
      ...result,
      results: result.results.slice(0, 10),
      _truncated: true,
    };
    return JSON.stringify(truncated);
  }

  // Generic truncation: take first 4000 chars
  return json.substring(0, 4000) + '... [TRUNCATED]';
}

/**
 * Runs the AI reasoning pipeline for a single user message.
 * Non-streaming version — returns the complete response.
 *
 * @param {Array<{ role: string, content: string }>} messages - Conversation history
 * @returns {Promise<{ response: string, toolCalls: Array, usage: Object }>}
 */
async function runReasoning(messages) {
  const client = getOpenAIClient();
  const model = getModelName();

  // Skip schema injection in system prompt to save tokens — schema is already in prompts.js
  const systemPrompt = buildSystemPrompt(null);
  const toolCallLog = [];

  // Build initial messages array with system prompt
  let conversationMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  let rounds = 0;
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const response = await client.chat.completions.create({
      model,
      messages: conversationMessages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.2,
      max_tokens: 1500,
    });

    const choice = response.choices[0];
    const message = choice.message;

    // Track token usage
    if (response.usage) {
      totalUsage.prompt_tokens += response.usage.prompt_tokens || 0;
      totalUsage.completion_tokens += response.usage.completion_tokens || 0;
      totalUsage.total_tokens += response.usage.total_tokens || 0;
    }

    // If no tool calls, we have the final response
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return {
        response: message.content || 'I was unable to generate a response. Please try rephrasing your question.',
        toolCalls: toolCallLog,
        usage: totalUsage,
      };
    }

    // Add assistant message with tool calls
    conversationMessages.push(message);

    // Execute each tool call
    for (const toolCall of message.tool_calls) {
      const functionName = toolCall.function.name;
      let args = {};

      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        args = {};
      }

      console.log(`[AI Reasoning] Calling tool: ${functionName}`, args);

      const result = await executeToolCall(functionName, args);
      const resultStr = truncateToolResult(result, functionName);

      toolCallLog.push({
        name: functionName,
        args,
        resultLength: resultStr.length,
      });

      // Add tool result to conversation
      conversationMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: resultStr,
      });
    }
  }

  // If we hit max rounds, return what we have
  return {
    response: 'I analyzed the data but reached the maximum number of analysis steps. Here is what I found so far. Please try a more specific question for deeper analysis.',
    toolCalls: toolCallLog,
    usage: totalUsage,
  };
}

/**
 * Runs the AI reasoning pipeline with streaming.
 * Returns a ReadableStream that can be consumed by the client.
 *
 * @param {Array<{ role: string, content: string }>} messages - Conversation history
 * @returns {Promise<ReadableStream>}
 */
async function runReasoningStream(messages) {
  const client = getOpenAIClient();
  const model = getModelName();

  // Skip schema injection to save tokens
  const systemPrompt = buildSystemPrompt(null);

  let conversationMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  let rounds = 0;

  // Pre-process: handle tool calls in non-streaming mode
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const response = await client.chat.completions.create({
      model,
      messages: conversationMessages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.2,
      max_tokens: 1500,
    });

    const choice = response.choices[0];
    const message = choice.message;

    // No tool calls — now stream the final response
    if (!message.tool_calls || message.tool_calls.length === 0) {
      break;
    }

    // Execute tool calls
    conversationMessages.push(message);

    for (const toolCall of message.tool_calls) {
      const functionName = toolCall.function.name;
      let args = {};
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        args = {};
      }

      const result = await executeToolCall(functionName, args);
      const resultStr = truncateToolResult(result, functionName);

      conversationMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: resultStr,
      });
    }
  }

  // Now stream the final response
  const stream = await client.chat.completions.create({
    model,
    messages: conversationMessages,
    temperature: 0.2,
    max_tokens: 1500,
    stream: true,
  });

  return stream;
}

module.exports = {
  runReasoning,
  runReasoningStream,
  executeToolCall,
};
