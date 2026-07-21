/**
 * Monday.com Authentication Module
 * 
 * Manages API token validation and authenticated request headers.
 * All Monday.com API calls must go through this module to ensure
 * proper authentication.
 */

const MONDAY_API_URL = 'https://api.monday.com/v2';

/**
 * Retrieves the Monday.com API token from environment variables.
 * @returns {string} The API token
 * @throws {Error} If the token is not configured
 */
function getApiToken() {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token || token === 'your_monday_api_token_here') {
    throw new Error(
      'MONDAY_API_TOKEN is not configured. Please set it in your .env.local file. ' +
      'You can find your API token in Monday.com > Admin > API.'
    );
  }
  return token;
}

/**
 * Returns the board IDs from environment configuration.
 * @returns {{ workOrdersBoardId: string, dealsBoardId: string }}
 * @throws {Error} If board IDs are not configured
 */
function getBoardIds() {
  const workOrdersBoardId = process.env.MONDAY_WORK_ORDERS_BOARD_ID;
  const dealsBoardId = process.env.MONDAY_DEALS_BOARD_ID;

  const missing = [];
  if (!workOrdersBoardId || workOrdersBoardId.includes('your_')) {
    missing.push('MONDAY_WORK_ORDERS_BOARD_ID');
  }
  if (!dealsBoardId || dealsBoardId.includes('your_')) {
    missing.push('MONDAY_DEALS_BOARD_ID');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing Monday.com board IDs: ${missing.join(', ')}. ` +
      'Please set them in your .env.local file. ' +
      'You can find board IDs in the board URL: monday.com/boards/{BOARD_ID}'
    );
  }

  return {
    workOrdersBoardId,
    dealsBoardId,
  };
}

/**
 * Builds authenticated headers for Monday.com API requests.
 * @returns {Object} Headers object with Authorization and Content-Type
 */
function getAuthHeaders() {
  const token = getApiToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': token,
    'API-Version': '2024-10',
  };
}

/**
 * Validates the Monday.com API connection by making a lightweight
 * test query. Returns connection status and account info.
 * @returns {Promise<{ connected: boolean, account: object|null, error: string|null }>}
 */
async function validateConnection() {
  try {
    const headers = getAuthHeaders();
    const query = `query { me { id name email account { id name } } }`;

    const response = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const statusText = response.statusText || 'Unknown error';
      if (response.status === 401) {
        return {
          connected: false,
          account: null,
          error: 'Invalid API token. Please check your MONDAY_API_TOKEN in .env.local.',
        };
      }
      return {
        connected: false,
        account: null,
        error: `Monday.com API returned HTTP ${response.status}: ${statusText}`,
      };
    }

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      return {
        connected: false,
        account: null,
        error: `Monday.com API error: ${data.errors[0].message}`,
      };
    }

    const me = data.data?.me;
    return {
      connected: true,
      account: {
        userId: me?.id,
        userName: me?.name,
        userEmail: me?.email,
        accountId: me?.account?.id,
        accountName: me?.account?.name,
      },
      error: null,
    };
  } catch (err) {
    return {
      connected: false,
      account: null,
      error: `Failed to connect to Monday.com: ${err.message}`,
    };
  }
}

/**
 * Validates that the configured board IDs exist and are accessible.
 * @returns {Promise<{ valid: boolean, boards: object[], error: string|null }>}
 */
async function validateBoards() {
  try {
    const headers = getAuthHeaders();
    const { workOrdersBoardId, dealsBoardId } = getBoardIds();

    const query = `query {
      boards(ids: [${workOrdersBoardId}, ${dealsBoardId}]) {
        id
        name
        items_count
        columns {
          id
          title
          type
        }
      }
    }`;

    const response = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      return {
        valid: false,
        boards: [],
        error: `API returned HTTP ${response.status}`,
      };
    }

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      return {
        valid: false,
        boards: [],
        error: data.errors[0].message,
      };
    }

    const boards = data.data?.boards || [];

    if (boards.length === 0) {
      return {
        valid: false,
        boards: [],
        error: 'No boards found with the configured IDs. Please verify MONDAY_WORK_ORDERS_BOARD_ID and MONDAY_DEALS_BOARD_ID.',
      };
    }

    const boardSummary = boards.map((b) => ({
      id: b.id,
      name: b.name,
      itemCount: b.items_count,
      columnCount: b.columns?.length || 0,
    }));

    return {
      valid: true,
      boards: boardSummary,
      error: null,
    };
  } catch (err) {
    return {
      valid: false,
      boards: [],
      error: `Board validation failed: ${err.message}`,
    };
  }
}

/**
 * Full health check — validates token, connection, and board access.
 * @returns {Promise<{ healthy: boolean, details: object }>}
 */
async function healthCheck() {
  const connectionResult = await validateConnection();

  if (!connectionResult.connected) {
    return {
      healthy: false,
      details: {
        connection: connectionResult,
        boards: { valid: false, boards: [], error: 'Skipped due to connection failure' },
      },
    };
  }

  const boardsResult = await validateBoards();

  return {
    healthy: connectionResult.connected && boardsResult.valid,
    details: {
      connection: connectionResult,
      boards: boardsResult,
    },
  };
}

module.exports = {
  MONDAY_API_URL,
  getApiToken,
  getBoardIds,
  getAuthHeaders,
  validateConnection,
  validateBoards,
  healthCheck,
};
