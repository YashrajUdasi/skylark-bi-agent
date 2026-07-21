/**
 * Monday.com GraphQL Client
 * 
 * Low-level GraphQL client for Monday.com API v2.
 * Handles request execution, rate limiting, retries,
 * and complexity budget monitoring.
 */

const { MONDAY_API_URL, getAuthHeaders } = require('./auth');

/** Maximum number of retries for rate-limited requests */
const MAX_RETRIES = 3;

/** Base delay in ms for exponential backoff */
const BASE_RETRY_DELAY = 1000;

/** Tracks complexity budget usage */
let complexityState = {
  lastQueryCost: 0,
  remainingBudget: null,
  resetInSeconds: null,
  lastUpdated: null,
};

/**
 * Executes a GraphQL query against the Monday.com API.
 * Automatically handles retries on rate limits with exponential backoff.
 *
 * @param {string} query - The GraphQL query string
 * @param {Object} [variables={}] - GraphQL variables
 * @param {number} [retryCount=0] - Current retry attempt (internal)
 * @returns {Promise<Object>} The response data
 * @throws {MondayAPIError} On unrecoverable API errors
 */
async function executeQuery(query, variables = {}, retryCount = 0) {
  const headers = getAuthHeaders();

  // Wrap query with complexity tracking
  const wrappedQuery = injectComplexityTracking(query);

  const body = JSON.stringify({
    query: wrappedQuery,
    variables,
  });

  try {
    const response = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers,
      body,
    });

    // Handle HTTP-level errors
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');

      // Rate limit (429)
      if (response.status === 429) {
        if (retryCount < MAX_RETRIES) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
          const delay = Math.max(retryAfter * 1000, BASE_RETRY_DELAY * Math.pow(2, retryCount));
          console.warn(`[Monday Client] Rate limited. Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          await sleep(delay);
          return executeQuery(query, variables, retryCount + 1);
        }
        throw new MondayAPIError('Rate limit exceeded after maximum retries', 'RATE_LIMIT', 429);
      }

      // Authentication error (401)
      if (response.status === 401) {
        throw new MondayAPIError('Invalid API token', 'AUTH_ERROR', 401);
      }

      // Server errors (5xx)
      if (response.status >= 500) {
        if (retryCount < MAX_RETRIES) {
          const delay = BASE_RETRY_DELAY * Math.pow(2, retryCount);
          console.warn(`[Monday Client] Server error ${response.status}. Retrying in ${delay}ms`);
          await sleep(delay);
          return executeQuery(query, variables, retryCount + 1);
        }
        throw new MondayAPIError(`Server error: ${response.status}`, 'SERVER_ERROR', response.status);
      }

      throw new MondayAPIError(
        `HTTP ${response.status}: ${errorBody || response.statusText}`,
        'HTTP_ERROR',
        response.status
      );
    }

    const data = await response.json();

    // Handle GraphQL-level errors
    if (data.errors && data.errors.length > 0) {
      const error = data.errors[0];
      const errorCode = error.extensions?.code || 'GRAPHQL_ERROR';

      // Handle complexity budget exhaustion
      if (errorCode === 'COMPLEXITY_BUDGET_EXHAUSTED' || error.message?.includes('complexity')) {
        if (retryCount < MAX_RETRIES) {
          const resetIn = error.extensions?.reset_in || 30;
          console.warn(`[Monday Client] Complexity budget exhausted. Waiting ${resetIn}s`);
          await sleep(resetIn * 1000);
          return executeQuery(query, variables, retryCount + 1);
        }
        throw new MondayAPIError('Complexity budget exhausted', 'COMPLEXITY_EXHAUSTED', 429);
      }

      throw new MondayAPIError(
        `GraphQL error: ${error.message}`,
        errorCode,
        null,
        data.errors
      );
    }

    // Update complexity tracking
    if (data.data?.complexity) {
      complexityState = {
        lastQueryCost: data.data.complexity.query || 0,
        remainingBudget: data.data.complexity.after || null,
        resetInSeconds: data.data.complexity.reset_in_x_seconds || null,
        lastUpdated: new Date().toISOString(),
      };
    }

    return data.data;
  } catch (err) {
    // Re-throw MondayAPIError instances
    if (err instanceof MondayAPIError) {
      throw err;
    }

    // Network errors
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      if (retryCount < MAX_RETRIES) {
        const delay = BASE_RETRY_DELAY * Math.pow(2, retryCount);
        console.warn(`[Monday Client] Network error. Retrying in ${delay}ms`);
        await sleep(delay);
        return executeQuery(query, variables, retryCount + 1);
      }
      throw new MondayAPIError('Network error: Unable to reach Monday.com API', 'NETWORK_ERROR', null);
    }

    throw new MondayAPIError(`Unexpected error: ${err.message}`, 'UNKNOWN', null);
  }
}

/**
 * Injects complexity tracking fields into a GraphQL query if not already present.
 * @param {string} query - The original query
 * @returns {string} Query with complexity tracking
 */
function injectComplexityTracking(query) {
  if (query.includes('complexity')) {
    return query;
  }

  // Insert complexity query at the beginning of the query body
  return query.replace(
    /\{/,
    '{ complexity { before query after reset_in_x_seconds }'
  );
}

/**
 * Returns current complexity budget state.
 * @returns {Object} Complexity tracking state
 */
function getComplexityState() {
  return { ...complexityState };
}

/**
 * Custom error class for Monday.com API errors.
 */
class MondayAPIError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code (RATE_LIMIT, AUTH_ERROR, etc.)
   * @param {number|null} httpStatus - HTTP status code
   * @param {Array|null} graphqlErrors - Raw GraphQL errors
   */
  constructor(message, code, httpStatus = null, graphqlErrors = null) {
    super(message);
    this.name = 'MondayAPIError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.graphqlErrors = graphqlErrors;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Returns a user-friendly error message.
   * @returns {string}
   */
  toUserMessage() {
    switch (this.code) {
      case 'AUTH_ERROR':
        return 'Unable to authenticate with Monday.com. Please check your API token configuration.';
      case 'RATE_LIMIT':
        return 'Monday.com API rate limit reached. Please try again in a moment.';
      case 'COMPLEXITY_EXHAUSTED':
        return 'Too many complex queries in a short time. Please wait a moment before trying again.';
      case 'NETWORK_ERROR':
        return 'Unable to connect to Monday.com. Please check your internet connection.';
      case 'SERVER_ERROR':
        return 'Monday.com is experiencing issues. Please try again later.';
      default:
        return `An error occurred while communicating with Monday.com: ${this.message}`;
    }
  }
}

/**
 * Utility sleep function for retry delays.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  executeQuery,
  getComplexityState,
  MondayAPIError,
};
