/**
 * Browser-compatible configuration loader
 * This version doesn't use Node.js-specific modules like fs, path, or os
 */

// Enhanced config interface with advanced filtering options (same as in cli/config.ts)
export interface UniterConfig {
  defaultChain?: string;
  defaultMinUsdValue?: number;
  minUSDValue?: number; // Minimum USD value for token filtering
  maxSlippage?: number;
  oneinchApiKey?: string;
  walletConnectProjectId?: string;
  // Advanced filtering options
  minTokenBalance?: number; // Minimum token count to consider (e.g., ignore tokens with < 0.001 balance)
  dustThresholdUsd?: number; // Alternative dust threshold
  excludeTokens?: string[]; // Token addresses to exclude from scanning
  includeZeroBalance?: boolean; // Whether to include zero balance tokens
  maxTokensToProcess?: number; // Limit number of tokens to process
}

// Default configuration (same as in cli/config.ts)
const DEFAULT_CONFIG = {
  defaultChain: 'base' as string,
  defaultMinUsdValue: 1 as number,
  maxSlippage: 1 as number,
  // Advanced filtering defaults
  minTokenBalance: 0.001 as number, // Ignore tokens with very small balances
  dustThresholdUsd: 5 as number, // More aggressive dust threshold
  excludeTokens: [] as string[], // No excluded tokens by default
  includeZeroBalance: false as boolean, // Skip zero balance tokens
  maxTokensToProcess: 100 as number, // Limit to top 100 tokens
};

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
  };
  
  return config;
}
