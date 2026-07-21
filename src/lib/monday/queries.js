/**
 * Monday.com GraphQL Query Definitions
 * 
 * All GraphQL queries used to interact with Monday.com boards.
 * Queries are optimized to request only necessary fields and
 * stay within complexity budget limits.
 */

/**
 * Fetches the structure (columns) of a board.
 * Used for dynamic schema discovery — we never hardcode column names.
 */
const FETCH_BOARD_STRUCTURE = `
  query GetBoardStructure($boardId: [ID!]!) {
    boards(ids: $boardId) {
      id
      name
      description
      items_count
      columns {
        id
        title
        type
        settings_str
      }
      groups {
        id
        title
        color
      }
    }
  }
`;

/**
 * Fetches a page of items from a board with all column values.
 * Uses cursor-based pagination (items_page) as recommended by Monday.com API v2.
 * 
 * @param limit - Number of items per page (max 500)
 */
const FETCH_ITEMS_PAGE = `
  query GetItemsPage($boardId: [ID!]!, $limit: Int!) {
    boards(ids: $boardId) {
      items_page(limit: $limit) {
        cursor
        items {
          id
          name
          group {
            id
            title
          }
          column_values {
            id
            text
            value
            type
          }
          created_at
          updated_at
        }
      }
    }
  }
`;

/**
 * Fetches the next page of items using a cursor.
 * This is more efficient than re-querying the board since it
 * doesn't require resolving the entire board object.
 */
const FETCH_NEXT_ITEMS_PAGE = `
  query GetNextItemsPage($cursor: String!, $limit: Int!) {
    next_items_page(limit: $limit, cursor: $cursor) {
      cursor
      items {
        id
        name
        group {
          id
          title
        }
        column_values {
          id
          text
          value
          type
        }
        created_at
        updated_at
      }
    }
  }
`;

/**
 * Lightweight query to get board metadata only (no items).
 * Used for quick validation and dashboard headers.
 */
const FETCH_BOARD_METADATA = `
  query GetBoardMetadata($boardId: [ID!]!) {
    boards(ids: $boardId) {
      id
      name
      description
      items_count
      updated_at
    }
  }
`;

/**
 * Fetches specific items by their IDs.
 * Useful when the AI needs to drill into specific records.
 */
const FETCH_ITEMS_BY_IDS = `
  query GetItemsByIds($itemIds: [ID!]!) {
    items(ids: $itemIds) {
      id
      name
      board {
        id
        name
      }
      group {
        id
        title
      }
      column_values {
        id
        text
        value
        type
      }
      created_at
      updated_at
    }
  }
`;

/**
 * Health check query — minimal complexity cost.
 */
const HEALTH_CHECK = `
  query HealthCheck {
    me {
      id
      name
    }
  }
`;

/**
 * Pagination configuration defaults.
 */
const PAGINATION = {
  /** Items per page — 200 is a safe balance of speed vs. complexity cost */
  DEFAULT_PAGE_SIZE: 200,
  /** Maximum items per page allowed by Monday.com */
  MAX_PAGE_SIZE: 500,
  /** Maximum total items to fetch (safety limit) */
  MAX_TOTAL_ITEMS: 10000,
};

module.exports = {
  FETCH_BOARD_STRUCTURE,
  FETCH_ITEMS_PAGE,
  FETCH_NEXT_ITEMS_PAGE,
  FETCH_BOARD_METADATA,
  FETCH_ITEMS_BY_IDS,
  HEALTH_CHECK,
  PAGINATION,
};
