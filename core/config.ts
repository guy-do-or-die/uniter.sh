/**
 * Shared configuration interface and defaults for uniter.sh
 * Used by both CLI and web environments
 */

// Enhanced config interface with advanced filtering options
export interface UniterConfig {
  defaultChain?: string;
  defaultMinUsdValue?: number;
  minUSDValue?: number; // Minimum USD value for token filtering
  maxSlippage?: number;
  oneinchApiKey?: string;
  walletConnectProjectId?: string;
  debug?: boolean; // Enable verbose debug output
  // API endpoint configuration
  oneinchBaseUrl?: string; // 1inch API base URL
  proxyBaseUrl?: string; // Proxy base URL for browser environments
  // API rate limiting configuration
  apiRequestInterval?: number; // Minimum milliseconds between API requests
  maxApiRetries?: number; // Maximum number of retries for failed API requests
  // Advanced filtering options
  minTokenBalance?: number; // Minimum token count to consider (e.g., ignore tokens with < 0.001 balance)
  dustThresholdUsd?: number; // Alternative dust threshold
  excludeTokens?: string[]; // Token addresses to exclude from scanning
  includeZeroBalance?: boolean; // Whether to include zero balance tokens
  maxTokensToProcess?: number; // Limit number of tokens to process
}

// Default configuration shared across all environments
export const DEFAULT_CONFIG: UniterConfig = {
  defaultChain: 'base' as string,
  defaultMinUsdValue: 1 as number,
  maxSlippage: 1 as number,
  debug: false as boolean, // Disable verbose debug output by default
  // API endpoint defaults
  oneinchBaseUrl: 'https://api.1inch.dev' as string,
  proxyBaseUrl: '/api/1inch' as string,
  // API rate limiting defaults
  apiRequestInterval: 1000 as number, // 1000ms between requests to avoid 429 errors
  maxApiRetries: 3 as number, // Maximum 3 retries for failed requests
  // Advanced filtering defaults
  minTokenBalance: 0.001 as number, // Ignore tokens with very small balances
  dustThresholdUsd: 5 as number, // More aggressive dust threshold
  excludeTokens: [] as string[], // No excluded tokens by default
  includeZeroBalance: false as boolean, // Skip zero balance tokens
  maxTokensToProcess: 100 as number, // Limit to top 100 tokens
};
