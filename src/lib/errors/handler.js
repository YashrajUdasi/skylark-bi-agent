/**
 * Global Error Handler
 * 
 * Provides a unified error handling system with user-friendly messages,
 * error classification, and graceful degradation support.
 */

/**
 * Base application error class.
 */
class AppError extends Error {
  /**
   * @param {string} message - Technical error message
   * @param {string} code - Error code for classification
   * @param {number} statusCode - HTTP status code
   * @param {Object|null} details - Additional error context
   */
  constructor(message, code = 'UNKNOWN_ERROR', statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Returns a user-friendly error message.
   */
  toUserMessage() {
    return USER_MESSAGES[this.code] || 'Something went wrong. Please try again.';
  }

  /**
   * Serializes the error for API responses.
   */
  toJSON() {
    return {
      error: true,
      code: this.code,
      message: this.toUserMessage(),
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV === 'development' ? { debug: this.message, details: this.details } : {}),
    };
  }
}

/**
 * User-friendly messages for each error code.
 */
const USER_MESSAGES = {
  // Monday.com errors
  MONDAY_AUTH_ERROR: 'Unable to connect to Monday.com. Please check your API token.',
  MONDAY_RATE_LIMIT: 'We\'re getting data too fast from Monday.com. Please wait a moment and try again.',
  MONDAY_NOT_FOUND: 'The requested Monday.com board or item was not found.',
  MONDAY_SERVER_ERROR: 'Monday.com is experiencing issues. Please try again later.',
  MONDAY_NETWORK_ERROR: 'Unable to connect to Monday.com. Please check your internet connection.',

  // OpenAI errors
  OPENAI_AUTH_ERROR: 'Unable to connect to the AI service. Please check your API key.',
  OPENAI_RATE_LIMIT: 'The AI service is busy. Please wait a moment and try again.',
  OPENAI_TOKEN_LIMIT: 'The query is too complex for a single analysis. Try asking a more specific question.',
  OPENAI_SERVER_ERROR: 'The AI service is experiencing issues. Please try again later.',

  // Data errors
  DATA_FETCH_ERROR: 'Unable to fetch data from Monday.com boards.',
  DATA_CLEAN_ERROR: 'An error occurred while processing the data.',
  DATA_EMPTY: 'No data found in the configured Monday.com boards.',
  DATA_QUALITY_LOW: 'The data quality is too low to produce reliable insights.',

  // Configuration errors
  CONFIG_MISSING: 'The application is not fully configured. Please check your environment variables.',
  BOARD_NOT_CONFIGURED: 'Monday.com board IDs are not configured.',

  // Generic
  UNKNOWN_ERROR: 'Something unexpected happened. Please try again.',
  TIMEOUT_ERROR: 'The request took too long. Please try a simpler query.',
};

/**
 * Wraps an async API route handler with error handling.
 *
 * @param {Function} handler - Async route handler (req) => Response
 * @returns {Function} Wrapped handler
 */
function withErrorHandling(handler) {
  return async function (req) {
    try {
      return await handler(req);
    } catch (err) {
      console.error('[Error Handler]', err);

      if (err instanceof AppError) {
        return Response.json(err.toJSON(), { status: err.statusCode });
      }

      // Classify unknown errors
      const classified = classifyError(err);
      return Response.json(classified.toJSON(), { status: classified.statusCode });
    }
  };
}

/**
 * Attempts to classify an unknown error into a known error type.
 *
 * @param {Error} err - The caught error
 * @returns {AppError} Classified error
 */
function classifyError(err) {
  const message = err.message || '';

  // Monday.com errors
  if (message.includes('MONDAY_API') || message.includes('monday.com')) {
    if (message.includes('401') || message.includes('auth') || message.includes('token')) {
      return new AppError(message, 'MONDAY_AUTH_ERROR', 401);
    }
    if (message.includes('429') || message.includes('rate') || message.includes('complexity')) {
      return new AppError(message, 'MONDAY_RATE_LIMIT', 429);
    }
    return new AppError(message, 'MONDAY_SERVER_ERROR', 502);
  }

  // OpenAI errors
  if (message.includes('openai') || message.includes('OpenAI') || err.name === 'OpenAIError') {
    if (message.includes('401') || message.includes('api_key') || message.includes('Incorrect API key')) {
      return new AppError(message, 'OPENAI_AUTH_ERROR', 401);
    }
    if (message.includes('429') || message.includes('rate_limit')) {
      return new AppError(message, 'OPENAI_RATE_LIMIT', 429);
    }
    if (message.includes('context_length') || message.includes('maximum context')) {
      return new AppError(message, 'OPENAI_TOKEN_LIMIT', 400);
    }
    return new AppError(message, 'OPENAI_SERVER_ERROR', 502);
  }

  // Configuration errors
  if (message.includes('.env') || message.includes('not configured') || message.includes('API_TOKEN')) {
    return new AppError(message, 'CONFIG_MISSING', 500);
  }

  // Network errors
  if (message.includes('fetch') || message.includes('ECONNREFUSED') || message.includes('network')) {
    return new AppError(message, 'MONDAY_NETWORK_ERROR', 503);
  }

  return new AppError(message, 'UNKNOWN_ERROR', 500);
}

/**
 * Attempts a graceful fallback when one data source fails.
 * Returns partial results with a warning instead of a full failure.
 *
 * @param {Function} primaryFn - Primary data function
 * @param {Function|null} fallbackFn - Fallback function
 * @param {string} context - Context description for logging
 * @returns {Promise<{ data: *, partial: boolean, error: string|null }>}
 */
async function withGracefulDegradation(primaryFn, fallbackFn = null, context = '') {
  try {
    const data = await primaryFn();
    return { data, partial: false, error: null };
  } catch (err) {
    console.warn(`[Graceful Degradation] ${context}: ${err.message}`);

    if (fallbackFn) {
      try {
        const fallbackData = await fallbackFn();
        return {
          data: fallbackData,
          partial: true,
          error: `Partial data: ${err.message}`,
        };
      } catch (fallbackErr) {
        return {
          data: null,
          partial: true,
          error: `Both primary and fallback failed: ${err.message}`,
        };
      }
    }

    return { data: null, partial: true, error: err.message };
  }
}

module.exports = {
  AppError,
  withErrorHandling,
  classifyError,
  withGracefulDegradation,
  USER_MESSAGES,
};
