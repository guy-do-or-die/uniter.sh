/**
 * Truly unified platform-agnostic 1inch API wrapper functions
 * Automatically detects environment (Node.js vs Browser) and handles CORS accordingly
 * Provides consistent interface for both CLI and web environments
 */

import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

// Environment detection
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// API configuration - will be set by config
let VITE_PROXY_BASE = '/api/1inch';
let ONEINCH_BASE_URL = 'https://api.1inch.dev';
let MIN_REQUEST_INTERVAL = 1000; // Default 1000ms between requests
let MAX_API_RETRIES = 5; // Default 3 retries

/**
 * Configure API settings - should be called by each environment with their config
 */
export function configureApi(config: { 
  oneinchBaseUrl?: string; 
  proxyBaseUrl?: string;
  apiRequestInterval?: number;
  maxApiRetries?: number;
}) {
  if (config.oneinchBaseUrl) {
    ONEINCH_BASE_URL = config.oneinchBaseUrl;
  }
  if (config.proxyBaseUrl) {
    VITE_PROXY_BASE = config.proxyBaseUrl;
  }
  if (config.apiRequestInterval) {
    MIN_REQUEST_INTERVAL = config.apiRequestInterval;
  }
  if (config.maxApiRetries) {
    MAX_API_RETRIES = config.maxApiRetries;
  }
  console.log(`🔧 DEBUG: API configured - Proxy: ${VITE_PROXY_BASE}, Direct: ${ONEINCH_BASE_URL}, Interval: ${MIN_REQUEST_INTERVAL}ms, Retries: ${MAX_API_RETRIES}`);
}

// Debug environment detection
console.log(`🌍 DEBUG: Environment detection - isBrowser: ${isBrowser}, isNode: ${isNode}`);

/**
 * Get the appropriate API URL based on environment
 */
function getApiUrl(endpoint: string): string {
  if (isBrowser) {
    // Use Vite dev proxy in browser (no API key needed, handled by proxy)
    const proxiedUrl = `${VITE_PROXY_BASE}${endpoint}`;
    console.log(`🌐 DEBUG: Browser environment - using Vite proxy: ${proxiedUrl}`);
    return proxiedUrl;
  } else {
    // Direct access in Node.js
    const fullUrl = `${ONEINCH_BASE_URL}${endpoint}`;
    console.log(`🖥️ DEBUG: Node.js environment - direct API call: ${fullUrl}`);
    return fullUrl;
  }
}

// Common token addresses
export const NATIVE_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

// Cache for dynamically discovered USDC addresses per chain
const USDC_ADDRESS_CACHE: Record<number, { address: string; timestamp: number }> = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ENS resolution cache
const ENS_CACHE: Record<string, { name: string | null; timestamp: number }> = {};
const ENS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Ethereum mainnet client for ENS resolution
let ensClient: ReturnType<typeof createPublicClient> | null = null;

function getEnsClient() {
  if (!ensClient) {
    ensClient = createPublicClient({
      chain: mainnet,
      transport: http()
    });
  }
  return ensClient;
}

// Clear invalid cache entries (for debugging)
function clearUsdcCache(chainId?: number) {
  if (chainId) {
    delete USDC_ADDRESS_CACHE[chainId];
    console.log(`🗑️ DEBUG: Cleared USDC cache for chain ${chainId}`);
  } else {
    Object.keys(USDC_ADDRESS_CACHE).forEach(key => delete USDC_ADDRESS_CACHE[parseInt(key)]);
    console.log(`🗑️ DEBUG: Cleared all USDC cache`);
  }
}

// API response types
export interface OneInchBalanceResponse {
  [tokenAddress: string]: string;
}

export interface OneInchTokenMetadata {
  [tokenAddress: string]: {
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
  };
}

export interface OneInchQuoteResponse {
  dstAmount: string;
  srcAmount: string;
  protocols: any[];
  gas: string;
}

export interface OneInchSearchResponse {
  symbol: string;
  chainId: number;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
  eip2612?: boolean;
  isFoT?: boolean;
  providers?: string[];
  rating?: string;
  tags?: any[];
}

export type OneInchSearchResults = OneInchSearchResponse[];

// Global request queue for 1inch API to prevent 429 errors
let requestQueue: Promise<any> = Promise.resolve();

/**
 * Unified umbrella function for all 1inch API requests
 * Handles rate limiting, retries, error handling, and debug logging consistently
 */
async function makeOneInchRequest<T>(
  endpoint: string,
  apiKey: string,
  options: {
    retryCount?: number;
    maxRetries?: number;
    description?: string;
  } = {}
): Promise<T> {
  const { retryCount = 0, maxRetries = MAX_API_RETRIES, description = 'API request' } = options;
  
  if (!apiKey && isNode) {
    throw new Error('1inch API key not provided');
  }

  return queueRequest(async () => {
    const url = getApiUrl(endpoint);
    
    try {
      // Build headers conditionally - Vite proxy handles auth in browser
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      
      if (isNode && apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const response = await fetch(url, { headers });

      console.log(`🔍 DEBUG: ${description}:`, {
        url,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        if (response.status === 400) {
          // 400 errors are permanent - don't retry
          console.error(`⚠️  ${description} failed: ${response.status} (likely insufficient liquidity or unsupported token)`);
          const errorText = await response.text();
          console.error(`🔍 DEBUG: Error response body:`, errorText);
          throw new Error(`1inch API 400 error: ${response.statusText}`);
        } else if (response.status === 429 && retryCount < maxRetries) {
          // Retry with exponential backoff for rate limits
          const backoffDelay = Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s
          console.error(`⏱️  Rate limited for ${description} - retrying in ${backoffDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          return makeOneInchRequest<T>(endpoint, apiKey, { ...options, retryCount: retryCount + 1 });
        } else {
          console.error(`🔍 DEBUG: ${description} error: ${response.status} ${response.statusText}`);
          const errorText = await response.text();
          console.error(`🔍 DEBUG: Error response body:`, errorText);
          throw new Error(`1inch API error: ${response.status} ${response.statusText}`);
        }
      }

      const result = await response.json();
      console.log(`✅ DEBUG: ${description} successful:`, {
        hasData: !!result,
        dataKeys: result && typeof result === 'object' ? Object.keys(result) : 'N/A'
      });
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes('1inch API')) {
        // Re-throw API errors as-is
        throw error;
      }
      // Handle network errors
      console.error(`🔍 DEBUG: Network error for ${description}:`, error);
      throw new Error(`Network error: ${error}`);
    }
  });
}

async function queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
  const currentRequest = requestQueue.then(async () => {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL));
    return requestFn();
  });
  
  requestQueue = currentRequest.catch(() => {});
  return currentRequest;
}

/**
 * Dynamically find USDC address on a given chain using 1inch search API
 */
export async function findUsdcAddress(
  chainId: number,
  apiKey: string,
  fetch: typeof globalThis.fetch
): Promise<string | null> {
  console.log(`🔍 DEBUG: findUsdcAddress called for chain ${chainId}`);
  
  // Clear invalid cache entries (temporary debug fix)
  if (USDC_ADDRESS_CACHE[chainId]?.address === '0' || USDC_ADDRESS_CACHE[chainId]?.address === null) {
    clearUsdcCache(chainId);
  }
  
  // Check cache first
  const cached = USDC_ADDRESS_CACHE[chainId];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`📦 DEBUG: Using cached USDC address for chain ${chainId}: ${cached.address}`);
    return cached.address;
  }
  
  console.log(`🔍 DEBUG: No cache found, searching for USDC on chain ${chainId}...`);

  try {
    const data: OneInchSearchResults = await makeOneInchRequest<OneInchSearchResults>(
      `/token/v1.3/${chainId}/search?query=USDC`,
      apiKey,
      { description: `USDC search on chain ${chainId}` }
    );
    console.log(`🔍 DEBUG: USDC search response for chain ${chainId}: Found ${data.length} tokens`);
    
    // Find the most likely USDC token (exact symbol match, 6 decimals, valid address)
    console.log(`🔍 DEBUG: Searching for USDC in ${data.length} tokens...`);
    for (const token of data) {
      console.log(`🔍 DEBUG: Checking token ${token.address}: ${token.symbol} (${token.decimals} decimals)`);
      
      // Skip invalid addresses
      if (!token.address || token.address === '0' || token.address === '0x0' || token.address.length < 10) {
        console.log(`⚠️ DEBUG: Skipping invalid address: ${token.address}`);
        continue;
      }
      
      if (token.symbol === 'USDC' && token.decimals === 6) {
        console.log(`✅ Found valid USDC on chain ${chainId}: ${token.address}`);
        // Cache the result
        USDC_ADDRESS_CACHE[chainId] = {
          address: token.address,
          timestamp: Date.now()
        };
        return token.address;
      }
    }

    console.warn(`No USDC token found on chain ${chainId}`);
    // Don't cache null results to allow retries
    return null;
  } catch (error) {
    console.warn(`Error searching for USDC on chain ${chainId}:`, (error as Error).message);
    return null;
  }
}



/**
 * Get wallet token balances from 1inch API
 * Platform-agnostic version that takes API key as parameter
 * Uses the working CLI logic
 */
export async function getWalletBalances(
  chainId: number, 
  walletAddress: string,
  apiKey: string
): Promise<OneInchBalanceResponse> {
  return makeOneInchRequest<OneInchBalanceResponse>(
    `/balance/v1.2/${chainId}/balances/${walletAddress}`,
    apiKey,
    { description: `Wallet balances for ${walletAddress} on chain ${chainId}` }
  );
}

/**
 * Get token metadata from 1inch API
 * Platform-agnostic version that takes API key as parameter
 * Uses the working CLI logic
 */
export async function getTokenMetadata(
  chainId: number,
  apiKey: string
): Promise<OneInchTokenMetadata> {
  const data = await makeOneInchRequest<any>(
    `/token/v1.2/${chainId}`,
    apiKey,
    { description: `Token metadata for chain ${chainId}` }
  );
  console.log(`🔍 DEBUG: Raw metadata response type:`, typeof data);
  console.log(`🔍 DEBUG: Raw metadata response structure:`, Array.isArray(data) ? `Array[${data.length}]` : `Object with keys: ${Object.keys(data).slice(0, 5)}`);
  
  // Handle CORS proxy response format differences
  if (Array.isArray(data)) {
    console.log(`🔍 DEBUG: Converting array metadata to object format`);
    console.log(`🔍 DEBUG: First array item:`, data[0]);
    // Convert array format to object format with addresses as keys
    const metadataObject: OneInchTokenMetadata = {};
    data.forEach((token: any, index: number) => {
      if (token && token.address) {
        metadataObject[token.address.toLowerCase()] = token;
        if (index < 3) {
          console.log(`🔍 DEBUG: Added token ${token.address} -> ${token.symbol}`);
        }
      } else {
        console.log(`🔍 DEBUG: Skipping invalid token at index ${index}:`, token);
      }
    });
    console.log(`🔍 DEBUG: Converted metadata object keys:`, Object.keys(metadataObject).slice(0, 5));
    return metadataObject;
  }
  
  // Handle case where CORS proxy wraps the response in an object
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    // Check if it's already in the correct format (object with token addresses as keys)
    const keys = Object.keys(data);
    if (keys.length > 0 && keys[0].startsWith('0x')) {
      console.log(`🔍 DEBUG: Data already in correct format`);
      return data;
    }
    
    // Check if the actual token data is nested (e.g., data.tokens or data.result)
    if (data.tokens && Array.isArray(data.tokens)) {
      console.log(`🔍 DEBUG: Found nested tokens array`);
      const metadataObject: OneInchTokenMetadata = {};
      data.tokens.forEach((token: any) => {
        if (token && token.address) {
          metadataObject[token.address.toLowerCase()] = token;
        }
      });
      return metadataObject;
    }
    
    // Check if it's an object where values are the token objects
    const firstValue = data[keys[0]];
    if (firstValue && firstValue.address) {
      console.log(`🔍 DEBUG: Converting indexed object to address-keyed object`);
      const metadataObject: OneInchTokenMetadata = {};
      Object.values(data).forEach((token: any) => {
        if (token && token.address) {
          metadataObject[token.address.toLowerCase()] = token;
        }
      });
      return metadataObject;
    }
  }
  
  return data;
}

/**
 * Resolve Ethereum address to ENS name using reverse resolution
 * Returns null if no ENS name is found or if resolution fails
 */
export async function resolveEnsName(address: string): Promise<string | null> {
  if (!address || !address.startsWith('0x')) {
    return null;
  }

  const normalizedAddress = address.toLowerCase();
  
  // Check cache first
  const cached = ENS_CACHE[normalizedAddress];
  if (cached && Date.now() - cached.timestamp < ENS_CACHE_TTL) {
    return cached.name;
  }

  try {
    const client = getEnsClient();
    const ensName = await client.getEnsName({
      address: address as `0x${string}`
    });
    
    // Cache the result (including null results)
    ENS_CACHE[normalizedAddress] = {
      name: ensName,
      timestamp: Date.now()
    };
    
    return ensName;
  } catch (error) {
    console.log(`🔍 DEBUG: ENS resolution failed for ${address}:`, error);
    
    // Cache null result to avoid repeated failed lookups
    ENS_CACHE[normalizedAddress] = {
      name: null,
      timestamp: Date.now()
    };
    
    return null;
  }
}

/**
 * Format address with ENS name if available
 * Returns "name.eth" if ENS name exists, or "0x123..." if no ENS name
 */
export async function formatAddressWithEns(address: string): Promise<string> {
  const ensName = await resolveEnsName(address);
  
  if (ensName) {
    // Show only ENS name when available
    return ensName;
  }
  
  // No ENS name, return shortened address
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format address with ENS name for connection display (shows both)
 * Returns "name.eth (0x123...)" or just "0x123..." if no ENS name
 */
export async function formatAddressWithEnsForConnection(address: string): Promise<string> {
  const ensName = await resolveEnsName(address);
  
  if (ensName) {
    // Show ENS name with shortened address for connection info
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return `${ensName} (${shortAddress})`;
  }
  
  // No ENS name, return shortened address
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Get quote from 1inch API
 * Platform-agnostic version that takes API key as parameter
 * Uses the working v6.0 API with graceful error handling
 */
export async function getQuote(
  chainId: number,
  fromTokenAddress: string,
  toTokenAddress: string,
  amount: string,
  apiKey: string
): Promise<OneInchQuoteResponse | null> {
  try {
    const result = await makeOneInchRequest<OneInchQuoteResponse>(
      `/swap/v6.0/${chainId}/quote?src=${fromTokenAddress}&dst=${toTokenAddress}&amount=${amount}`,
      apiKey,
      { description: `Quote for ${fromTokenAddress} on chain ${chainId}` }
    );
    
    // Log specific quote details
    console.log(`🔍 DEBUG: Quote response for ${fromTokenAddress}:`, {
      dstAmount: result.dstAmount,
      srcAmount: result.srcAmount,
      hasProtocols: !!result.protocols
    });
    
    return result;
  } catch (error) {
    // Graceful failure for quote requests - return null instead of throwing
    // This allows the scanning to continue even if some tokens can't be quoted
    if (error instanceof Error && error.message.includes('400')) {
      console.error(`⚠️  Token quote not available for ${fromTokenAddress} on chain ${chainId}`);
    }
    return null;
  }
}
