/**
 * Unified cache layer with automatic fallback:
 * - Vercel KV for production Edge Functions
 * - In-memory cache for local development
 * - Simple key-value interface for all data types
 */

// Environment detection
const isVercelProduction = process.env.VERCEL_ENV === 'production';
const isVercelPreview = process.env.VERCEL_ENV === 'preview';
const isVercelEnvironment = isVercelProduction || isVercelPreview;

// In-memory cache for local development
const memoryCache = new Map<string, { data: any; expires: number }>();

// Default TTL values (in seconds)
export const TTL = {
  short: 5 * 60,        // 5 minutes
  medium: 60 * 60,      // 1 hour  
  long: 24 * 60 * 60,   // 24 hours
  week: 7 * 24 * 60 * 60 // 7 days
} as const;

// Lazy import of Vercel KV to avoid errors in development
let kv: any = null;
const getKV = async () => {
  if (!kv && isVercelEnvironment) {
    try {
      const { kv: vercelKV } = await import('@vercel/kv');
      kv = vercelKV;
    } catch (error) {
      console.warn('Vercel KV not available, using memory cache');
    }
  }
  return kv;
};

/**
 * Simple cache interface - get/set/delete with automatic fallback
 */
export class Cache {
  
  /**
   * Get cached data
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      // Try Vercel KV first (if available)
      const kvInstance = await getKV();
      if (kvInstance) {
        const result = await kvInstance.get(key) as T | null;
        if (result !== null) {
          return result;
        }
      }
      
      // Fallback to memory cache
      const cached = memoryCache.get(key);
      if (cached) {
        // Check if expired
        if (Date.now() < cached.expires) {
          return cached.data;
        } else {
          // Remove expired entry
          memoryCache.delete(key);
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`Cache get error for ${key}:`, error);
      return null;
    }
  }
  
  /**
   * Set cached data with TTL
   */
  static async set<T>(key: string, data: T, ttlSeconds: number = TTL.long): Promise<void> {
    try {
      // Try Vercel KV first (if available)
      const kvInstance = await getKV();
      if (kvInstance) {
        await kvInstance.set(key, data, { ex: ttlSeconds });
      }
      
      // Always set in memory cache as fallback
      memoryCache.set(key, {
        data,
        expires: Date.now() + (ttlSeconds * 1000)
      });
    } catch (error) {
      console.warn(`Cache set error for ${key}:`, error);
      // Don't throw - cache failures shouldn't break the app
    }
  }
  
  /**
   * Delete cached entry
   */
  static async del(key: string): Promise<void> {
    try {
      // Try Vercel KV first (if available)
      const kvInstance = await getKV();
      if (kvInstance) {
        await kvInstance.del(key);
      }
      
      // Remove from memory cache
      memoryCache.delete(key);
    } catch (error) {
      console.warn(`Cache delete error for ${key}:`, error);
    }
  }
  
  /**
   * Check if a key exists in cache
   */
  static async exists(key: string): Promise<boolean> {
    try {
      // Try Vercel KV first (if available)
      const kvInstance = await getKV();
      if (kvInstance) {
        const result = await kvInstance.exists(key);
        if (result === 1) return true;
      }
      
      // Check memory cache
      const cached = memoryCache.get(key);
      return cached ? Date.now() < cached.expires : false;
    } catch (error) {
      console.warn(`Cache exists error for ${key}:`, error);
      return false;
    }
  }
}

/**
 * Simplified cache helper functions using the new Cache class
 */

// USDC address caching
export async function getCachedUsdcAddress(chainId: number): Promise<string | null> {
  return Cache.get<string>(`usdc:${chainId}`);
}

export async function setCachedUsdcAddress(chainId: number, address: string): Promise<void> {
  return Cache.set(`usdc:${chainId}`, address, TTL.long);
}

// Token metadata caching
export interface TokenMetadata {
  symbol: string;
  decimals: number;
  name: string;
}

export async function getCachedTokenMetadata(chainId: number, address: string): Promise<TokenMetadata | null> {
  return Cache.get<TokenMetadata>(`token:${chainId}:${address.toLowerCase()}`);
}

export async function setCachedTokenMetadata(chainId: number, address: string, metadata: TokenMetadata): Promise<void> {
  return Cache.set(`token:${chainId}:${address.toLowerCase()}`, metadata, TTL.week);
}

// ENS resolution caching
export async function getCachedEnsResolution(address: string): Promise<string | null> {
  return Cache.get<string>(`ens:${address.toLowerCase()}`);
}

export async function setCachedEnsResolution(address: string, ensName: string): Promise<void> {
  return Cache.set(`ens:${address.toLowerCase()}`, ensName, TTL.long);
}

// Native token metadata caching
export interface NativeTokenMetadata {
  symbol: string;
  name: string;
  decimals: number;
}

export async function getCachedNativeToken(chainId: number): Promise<NativeTokenMetadata | null> {
  return Cache.get<NativeTokenMetadata>(`native:${chainId}`);
}

export async function setCachedNativeToken(chainId: number, metadata: NativeTokenMetadata): Promise<void> {
  return Cache.set(`native:${chainId}`, metadata, TTL.week);
}

// Failed search tracking (to prevent API spam)
export async function isSearchRecentlyFailed(searchType: string, chainId: number, query: string): Promise<boolean> {
  const key = `failed:${searchType}:${chainId}:${query}`;
  return Cache.exists(key);
}

export async function markSearchAsFailed(searchType: string, chainId: number, query: string): Promise<void> {
  const key = `failed:${searchType}:${chainId}:${query}`;
  return Cache.set(key, true, TTL.medium);
}

// Rate limiting tracking
export async function isRateLimited(endpoint: string): Promise<boolean> {
  return Cache.exists(`rate:${endpoint}`);
}

export async function markRateLimited(endpoint: string): Promise<void> {
  return Cache.set(`rate:${endpoint}`, true, TTL.short);
}
