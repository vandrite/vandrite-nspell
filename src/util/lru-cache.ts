/**
 * LRU (Least Recently Used) Cache
 *
 * A simple cache with a maximum size that evicts the least recently used
 * entries when the cache is full.
 */

/**
 * LRU Cache implementation using Map's insertion order
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get a value from the cache
   * Moves the key to the end (most recently used)
   */
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  /**
   * Set a value in the cache
   * Evicts the least recently used entry if cache is full
   */
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  /**
   * Check if key exists in cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Export cache to JSON-serializable format
   * Useful for persisting cache to localStorage or file
   */
  toJSON(): { entries: [K, V][]; maxSize: number } {
    return {
      entries: Array.from(this.cache.entries()),
      maxSize: this.maxSize,
    };
  }

  /**
   * Import cache from previously exported data
   */
  fromJSON(data: { entries: [K, V][]; maxSize?: number }): void {
    this.cache.clear();
    if (data.entries) {
      for (const [key, value] of data.entries) {
        this.set(key, value);
      }
    }
  }

  /**
   * Create a new LRUCache from exported data
   */
  static fromJSON<K, V>(data: { entries: [K, V][]; maxSize?: number }): LRUCache<K, V> {
    const cache = new LRUCache<K, V>(data.maxSize || 1000);
    cache.fromJSON(data);
    return cache;
  }
}
