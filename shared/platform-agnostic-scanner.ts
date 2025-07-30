/**
 * Platform-agnostic token scanning module
 * Works in both Node.js and browser environments
 */

import { SUPPORTED_CHAINS } from '../cli/chains.js';
import * as defaultApi from './platform-agnostic-api.js';
import { 
  TokenBalance, 
  processTokenBalances, 
  filterTokens, 
  categorizeTokens, 
  calculatePortfolioStats 
} from './platform-agnostic-token-processor.js';

// API interface for dependency injection
export interface ApiImplementation {
  getWalletBalances: typeof defaultApi.getWalletBalances;
  getTokenMetadata: typeof defaultApi.getTokenMetadata;
  getQuote: typeof defaultApi.getQuote;
}

// Token scan config interface
export interface TokenScanConfig {
  oneinchApiKey: string;
  maxTokensToProcess?: number;
  excludeTokens?: string[];
  defaultMinUsdValue?: number;
}

// Wallet session interface
export interface WalletSession {
  address: string;
  chainId: number;
  client?: any; // Optional for browser
  topic?: string; // Optional for browser
  isDemo?: boolean; // Optional for demo mode
}

// Token scan result interface
export interface TokenScanResult {
  allTokens: TokenBalance[];
  dustTokens: TokenBalance[];
  mediumTokens: TokenBalance[];
  significantTokens: TokenBalance[];
  totalUSD: number;
  chainId: number;
  chainName: string;
  tokens?: TokenBalance[]; // For backward compatibility with existing code
}

/**
 * Core token scanning function - platform agnostic
 * @param session - Wallet session containing address and chain info
 * @param config - Configuration object with API key and settings
 * @param dustThresholdUsd - Maximum USD value for dust tokens (default: $5)
 * @param api - Optional API implementation (defaults to Node.js implementation)
 */
export async function scanTokensCore(
  session: WalletSession, 
  config: TokenScanConfig,
  dustThresholdUsd: number = 5,
  api: ApiImplementation = defaultApi
): Promise<TokenScanResult> {
  if (!config.oneinchApiKey) {
    throw new Error('1inch API key not configured');
  }

  const chainInfo = SUPPORTED_CHAINS.find(c => c.id === session.chainId);
  if (!chainInfo) {
    throw new Error(`Unsupported chain ID: ${session.chainId}`);
  }

  try {
    console.log(`🔄 Scanning ${chainInfo.name} for token balances...`);
    
    // Fetch data from 1inch API using provided API implementation
    const [balanceData, tokenMetadata] = await Promise.all([
      api.getWalletBalances(session.chainId, session.address, config.oneinchApiKey),
      api.getTokenMetadata(session.chainId, config.oneinchApiKey)
    ]);
    
    console.log('📊 Raw balance data:', Object.keys(balanceData).length, 'tokens found');
    console.log('📊 Token metadata:', Object.keys(tokenMetadata).length, 'tokens available');

    // Process tokens and calculate USD values
    const processedTokens = await processTokenBalances(
      balanceData,
      tokenMetadata,
      session.chainId,
      config.oneinchApiKey
    );

    // Apply filtering based on configuration
    // Use a low threshold for filtering (0.01) to include all valuable tokens
    // Higher thresholds are used only for categorization, not filtering
    const filteredTokens = filterTokens(processedTokens, {
      minUSDValue: 0.01, // Low threshold to include tokens like KAITO ($2.33) and CLANKER ($1.99)
      maxTokensToProcess: config.maxTokensToProcess || 100,
      excludeZeroBalances: true,
    });

    // Categorize tokens by USD value
    const { dustTokens, mediumTokens, significantTokens } = categorizeTokens(
      filteredTokens,
      dustThresholdUsd,
      100 // Significant threshold ($100)
    );

    // Calculate portfolio stats
    const { totalUSD } = calculatePortfolioStats(filteredTokens);

    // Return scan results
    return {
      allTokens: filteredTokens,
      dustTokens,
      mediumTokens,
      significantTokens,
      totalUSD,
      chainId: session.chainId,
      chainName: chainInfo.name,
      // Add tokens property for backward compatibility with web terminal
      tokens: [...filteredTokens].map(token => ({
        ...token,
        isDust: token.balanceUSD < dustThresholdUsd,
        formattedBalance: `${token.balanceFormatted} ${token.symbol}`,
        usdValue: token.balanceUSD
      }))
    };
  } catch (error) {
    console.error(`❌ Scan failed for ${chainInfo.name}:`, error);
    throw new Error(`Scan failed for ${chainInfo.name}: ${(error as Error).message}`);
  }
}

/**
 * Scan tokens across multiple chains - platform agnostic
 * @param session - Wallet session containing address
 * @param config - Configuration object with API key and settings
 * @param dustThresholdUsd - Maximum USD value for dust tokens (default: $5)
 * @param api - Optional API implementation (defaults to Node.js implementation)
 */
export async function scanTokensMultiChainCore(
  session: WalletSession,
  config: TokenScanConfig,
  dustThresholdUsd: number = 5,
  api: ApiImplementation = defaultApi
): Promise<TokenScanResult[]> {
  if (!config.oneinchApiKey) {
    throw new Error('1inch API key not configured');
  }

  if (!session || !session.address) {
    throw new Error('No wallet session available');
  }

  const results: TokenScanResult[] = [];
  
  console.log(`🔄 Starting multichain scan for address: ${session.address}`);
  console.log(`🔄 Demo mode: ${session.isDemo ? 'Yes' : 'No'}`);
  
  // Scan tokens on all supported chains
  for (const chain of SUPPORTED_CHAINS) {
    try {
      console.log(`🔍 Scanning ${chain.name} (${chain.id})...`);
      
      const walletSession = {
        address: session.address,
        chainId: chain.id,
        client: session.client, // Pass through if available
        topic: session.topic, // Pass through if available
        isDemo: session.isDemo // Pass through demo mode flag
      };
      
      // Pass the same API implementation to ensure consistent behavior
      const result = await scanTokensCore(walletSession, config, dustThresholdUsd, api);
      
      // Add chain name to the result for display in the UI
      result.chainName = chain.name;
      result.chainId = chain.id;
      
      // Debug the result
      console.log(`📊 ${chain.name} scan result:`, 
        JSON.stringify({
          chainId: result.chainId,
          chainName: result.chainName,
          tokenCount: result.tokens?.length || 0,
          significantTokens: result.tokens?.filter((t: any) => !t.isDust)?.length || 0
        }));
      
      results.push(result);
      
    } catch (error) {
      console.warn(`⚠️ Failed to scan ${chain.name}:`, (error as Error).message);
      // Continue with other chains even if one fails
    }
  }
  
  return results;
}
