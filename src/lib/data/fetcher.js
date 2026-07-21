/**
 * Data Fetcher
 * 
 * Orchestrates fetching data from Monday.com boards.
 * Handles pagination, caching, and transforms raw API responses
 * into structured records ready for the cleaning engine.
 */

const { executeQuery } = require('../monday/client');
const {
  FETCH_BOARD_STRUCTURE,
  FETCH_ITEMS_PAGE,
  FETCH_NEXT_ITEMS_PAGE,
  PAGINATION,
} = require('../monday/queries');
const { getBoardIds } = require('../monday/auth');
const cache = require('./cache');

/**
 * Fetches the schema (column definitions) of a board.
 * Results are cached to avoid redundant API calls.
 *
 * @param {string} boardId - The Monday.com board ID
 * @returns {Promise<Object>} Board schema with columns, groups, and metadata
 */
async function fetchBoardSchema(boardId) {
  const cacheKey = cache.CacheKeys.boardSchema(boardId);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await executeQuery(FETCH_BOARD_STRUCTURE, {
    boardId: [boardId],
  });

  const board = data.boards?.[0];
  if (!board) {
    throw new Error(`Board ${boardId} not found or not accessible`);
  }

  const schema = {
    id: board.id,
    name: board.name,
    description: board.description,
    itemCount: board.items_count,
    columns: (board.columns || []).map((col) => ({
      id: col.id,
      title: col.title,
      type: col.type,
      settings: parseColumnSettings(col.settings_str),
    })),
    groups: (board.groups || []).map((g) => ({
      id: g.id,
      title: g.title,
      color: g.color,
    })),
  };

  cache.set(cacheKey, schema);
  return schema;
}

/**
 * Safely parses column settings JSON string.
 * @param {string} settingsStr - JSON string from Monday.com
 * @returns {Object} Parsed settings or empty object
 */
function parseColumnSettings(settingsStr) {
  if (!settingsStr) return {};
  try {
    return JSON.parse(settingsStr);
  } catch {
    return {};
  }
}

/**
 * Fetches ALL items from a board using cursor-based pagination.
 * Automatically handles pagination loops and respects the MAX_TOTAL_ITEMS safety limit.
 *
 * @param {string} boardId - The Monday.com board ID
 * @param {number} [pageSize=PAGINATION.DEFAULT_PAGE_SIZE] - Items per page
 * @returns {Promise<Object[]>} Array of raw item objects
 */
async function fetchAllBoardItems(boardId, pageSize = PAGINATION.DEFAULT_PAGE_SIZE) {
  const cacheKey = cache.CacheKeys.boardItems(boardId);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const allItems = [];
  let cursor = null;
  let pageCount = 0;

  // First page — uses boards(ids:) query
  const firstPageData = await executeQuery(FETCH_ITEMS_PAGE, {
    boardId: [boardId],
    limit: Math.min(pageSize, PAGINATION.MAX_PAGE_SIZE),
  });

  const firstPage = firstPageData.boards?.[0]?.items_page;
  if (!firstPage) {
    throw new Error(`No items found on board ${boardId}`);
  }

  allItems.push(...(firstPage.items || []));
  cursor = firstPage.cursor;
  pageCount++;

  // Subsequent pages — uses next_items_page(cursor:) for efficiency
  while (cursor && allItems.length < PAGINATION.MAX_TOTAL_ITEMS) {
    const nextPageData = await executeQuery(FETCH_NEXT_ITEMS_PAGE, {
      cursor,
      limit: Math.min(pageSize, PAGINATION.MAX_PAGE_SIZE),
    });

    const nextPage = nextPageData.next_items_page;
    if (!nextPage || !nextPage.items || nextPage.items.length === 0) {
      break;
    }

    allItems.push(...nextPage.items);
    cursor = nextPage.cursor;
    pageCount++;
  }

  console.log(`[Fetcher] Board ${boardId}: Fetched ${allItems.length} items in ${pageCount} pages`);

  cache.set(cacheKey, allItems);
  return allItems;
}

/**
 * Transforms raw Monday.com items into flat, structured records.
 * Each record is a plain object with column titles as keys and text values.
 *
 * @param {Object[]} items - Raw items from Monday.com API
 * @param {Object} schema - Board schema (from fetchBoardSchema)
 * @returns {Object[]} Array of flat record objects
 */
function transformItemsToRecords(items, schema) {
  // Build a column type map for reference
  const columnTypeMap = {};
  for (const col of schema.columns) {
    columnTypeMap[col.id] = { title: col.title, type: col.type };
  }

  return items.map((item) => {
    const record = {
      _itemId: item.id,
      _itemName: item.name,
      _groupId: item.group?.id || null,
      _groupTitle: item.group?.title || null,
      _createdAt: item.created_at || null,
      _updatedAt: item.updated_at || null,
    };

    // Flatten column values into the record
    for (const cv of (item.column_values || [])) {
      const colTitle = cv.title || columnTypeMap[cv.id]?.title || cv.id;
      const colType = cv.type || columnTypeMap[cv.id]?.type || 'unknown';

      // Use text representation for human-readable values
      // Also store the raw JSON value for structured types
      record[colTitle] = cv.text || null;

      // For specific types, parse the JSON value for structured access
      if (cv.value && colType !== 'text' && colType !== 'long_text') {
        try {
          const parsed = JSON.parse(cv.value);
          record[`_raw_${colTitle}`] = parsed;
        } catch {
          // Value is not JSON — skip raw storage
        }
      }
    }

    return record;
  });
}

/**
 * Fetches and transforms all data from a single board.
 * Returns structured records with schema metadata.
 *
 * @param {string} boardId - The Monday.com board ID
 * @returns {Promise<{ schema: Object, records: Object[], raw: Object[] }>}
 */
async function fetchBoard(boardId) {
  const [schema, items] = await Promise.all([
    fetchBoardSchema(boardId),
    fetchAllBoardItems(boardId),
  ]);

  const records = transformItemsToRecords(items, schema);

  return {
    schema,
    records,
    raw: items,
  };
}

/**
 * Fetches all data from both configured boards (Work Orders + Deals).
 * This is the main entry point for the data pipeline.
 *
 * @returns {Promise<{ workOrders: Object, deals: Object, fetchedAt: string }>}
 */
async function fetchAllData() {
  const allDataCacheKey = cache.CacheKeys.allData();
  const cached = cache.get(allDataCacheKey);
  if (cached) return cached;

  const { workOrdersBoardId, dealsBoardId } = getBoardIds();

  // Fetch both boards in parallel for speed
  const [workOrders, deals] = await Promise.all([
    fetchBoard(workOrdersBoardId),
    fetchBoard(dealsBoardId),
  ]);

  const result = {
    workOrders: {
      boardName: workOrders.schema.name,
      boardId: workOrdersBoardId,
      schema: workOrders.schema,
      records: workOrders.records,
      totalItems: workOrders.records.length,
    },
    deals: {
      boardName: deals.schema.name,
      boardId: dealsBoardId,
      schema: deals.schema,
      records: deals.records,
      totalItems: deals.records.length,
    },
    fetchedAt: new Date().toISOString(),
  };

  cache.set(allDataCacheKey, result);
  return result;
}

/**
 * Forces a refresh of all cached data.
 * @returns {Promise<Object>} Fresh data from both boards
 */
async function refreshAllData() {
  cache.invalidateAll();
  return fetchAllData();
}

module.exports = {
  fetchBoardSchema,
  fetchAllBoardItems,
  transformItemsToRecords,
  fetchBoard,
  fetchAllData,
  refreshAllData,
};
