/**
 * Advanced cache management system
 */
class CacheManager {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes
        this.maxSize = 100; // Maximum number of cache entries
        this.cleanupInterval = null;
        
        this.startCleanup();
    }

    set(key, data, ttl = this.defaultTTL) {
        // Remove oldest entries if cache is full
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
            accessed: Date.now()
        });
    }

    get(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            return null;
        }

        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        // Update access time
        entry.accessed = Date.now();
        return entry.data;
    }

    has(key) {
        return this.get(key) !== null;
    }

    delete(key) {
        return this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    invalidatePattern(pattern) {
        for (let [key] of this.cache) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    getStats() {
        const entries = Array.from(this.cache.values());
        const now = Date.now();
        
        return {
            totalEntries: this.cache.size,
            expiredEntries: entries.filter(entry => 
                now - entry.timestamp > entry.ttl
            ).length,
            memoryUsage: this.getMemoryUsage(),
            oldestEntry: entries.length > 0 ? 
                Math.min(...entries.map(e => e.timestamp)) : null,
            newestEntry: entries.length > 0 ? 
                Math.max(...entries.map(e => e.timestamp)) : null
        };
    }

    getMemoryUsage() {
        // Rough estimation of memory usage
        let size = 0;
        for (let [key, value] of this.cache) {
            size += key.length * 2; // Rough string size
            size += JSON.stringify(value).length * 2;
        }
        return size;
    }

    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000); // Clean up every minute
    }

    cleanup() {
        const now = Date.now();
        for (let [key, entry] of this.cache) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key);
            }
        }
    }

    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

window.CacheManager = CacheManager;
