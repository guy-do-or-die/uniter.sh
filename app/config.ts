/**
 * Browser-compatible configuration loading for uniter.sh
 * Only uses environment variables (no file system access)
 */

import { UniterConfig, DEFAULT_CONFIG } from '../core/config.js';

// Re-export for external consumers
export type { UniterConfig };

/**
 * Load configuration from environment variables only (browser-compatible)
 */
export function loadBrowserConfig(): UniterConfig {
  // In browser, we can only use environment variables
  const config: UniterConfig = {
    ...DEFAULT_CONFIG,
    // Environment variables from import.meta.env
    ...(import.meta.env.ONEINCH_API_KEY && { 
      oneinchApiKey: import.meta.env.ONEINCH_API_KEY 
    }),
    // Support both old WALLETCONNECT_PROJECT_ID and new REOWN_PROJECT_ID
    ...((import.meta.env.VITE_REOWN_PROJECT_ID || import.meta.env.VITE_WALLETCONNECT_PROJECT_ID) && { 
      walletConnectProjectId: import.meta.env.VITE_REOWN_PROJECT_ID || import.meta.env.VITE_WALLETCONNECT_PROJECT_ID 
    }),
    ...(import.meta.env.VITE_DEFAULT_CHAIN && { 
      defaultChain: import.meta.env.VITE_DEFAULT_CHAIN 
    }),
    ...(import.meta.env.VITE_DEFAULT_MIN_USD_VALUE && { 
      defaultMinUsdValue: parseFloat(import.meta.env.VITE_DEFAULT_MIN_USD_VALUE) 
    }),
    // API endpoint configuration
    ...(import.meta.env.VITE_PROXY_BASE && { 
      proxyBaseUrl: import.meta.env.VITE_PROXY_BASE 
    }),
    ...(import.meta.env.ONEINCH_BASE_URL && { 
      oneinchBaseUrl: import.meta.env.ONEINCH_BASE_URL 
    }),
  };
  
  return config;
}
