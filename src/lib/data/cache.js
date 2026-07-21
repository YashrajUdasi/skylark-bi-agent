/**
 * In-Memory Cache
 * 
 * Provides TTL-based caching for Monday.com data to reduce
 * API calls during a chat session. Data is cached per board
 * and automatically invalidated after the TTL expires.
 */

/** Default cache TTL in milliseconds (5 minutes) */
const DEFAULT_TTL = (parseInt(process.env.CACHE_TTL_SECONDS, 10) || 300) * 1000;

/**
 * @typedef {Object} CacheEntry
 * @property {*} data - The cached data
 * @property {number} timestamp - When the entry was created (ms)
 * @property {number} ttl - Time-to-live in milliseconds
 */

/** @type {Map<string, CacheEntry>} */
const cache = new Map();

/**
 * Retrieves a value from the cache.
 * Returns null if the key doesn't exist or has expired.
 *
 * @param {string} key - Cache key
 * @returns {*|null} The cached value, or null if expired/missing
 */
function get(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Stores a value in the cache with an optional TTL.
 *
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 * @param {number} [ttl=DEFAULT_TTL] - Time-to-live in milliseconds
 */
function set(key, data, ttl = DEFAULT_TTL) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
}

/**
 * Checks if a key exists and is not expired.
 *
 * @param {string} key - Cache key
 * @returns {boolean}
 */
function has(key) {
  return get(key) !== null;
}

/**
 * Removes a specific key from the cache.
 *
 * @param {string} key - Cache key to invalidate
 */
function invalidate(key) {
  cache.delete(key);
}

/**
 * Removes all entries matching a prefix.
 * Useful for invalidating all data for a specific board.
 *
 * @param {string} prefix - Key prefix to match
 */
function invalidateByPrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Clears the entire cache.
 */
function invalidateAll() {
  cache.clear();
}

/**
 * Returns cache statistics for monitoring.
 *
 * @returns {{ size: number, keys: string[], oldestEntry: string|null }}
 */
function getStats() {
  const keys = Array.from(cache.keys());
  let oldestTimestamp = Infinity;
  let oldestKey = null;

  for (const [key, entry] of cache.entries()) {
    if (entry.timestamp < oldestTimestamp) {
      oldestTimestamp = entry.timestamp;
      oldestKey = key;
    }
  }

  return {
    size: cache.size,
    keys,
    oldestEntry: oldestKey,
  };
}

/**
 * Standard cache key builders for consistency.
 */
const CacheKeys = {
  boardSchema: (boardId) => `board:${boardId}:schema`,
  boardItems: (boardId) => `board:${boardId}:items`,
  boardClean: (boardId) => `board:${boardId}:clean`,
  analytics: (type) => `analytics:${type}`,
  allData: () => 'all-data',
};

module.exports = {
  get,
  set,
  has,
  invalidate,
  invalidateByPrefix,
  invalidateAll,
  getStats,
  CacheKeys,
  DEFAULT_TTL,
};
