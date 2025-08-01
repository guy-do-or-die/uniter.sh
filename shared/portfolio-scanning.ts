/**
 * Portfolio Scanning Logic
 * Single responsibility: Orchestrate token scanning across single and multiple chains
 */

import { getChainById, getSupportedChains } from './chains.js';
import * as defaultApi from './api.js';
import { 
  processTokenBalances, 
  filterTokens, 
  categorizeTokens, 
  calculatePortfolioStats 
} from './token-processing.js';
import type {
  WalletSession,
  TokenScanConfig,
  TokenScanResult,
  ApiImplementation
} from './types.js';

/**
 * Core token scanning function - platform agnostic
 * Scans tokens on a single chain and returns structured results
 */
export async function scanTokens(
  session: WalletSession, 
  config: TokenScanConfig,
  dustThresholdUsd: number = 5,
  api: ApiImplementation = defaultApi
): Promise<TokenScanResult> {
  if (!config.oneinchApiKey) {
    throw new Error('1inch API key not configured');
  }

  const chainInfo = getChainById(session.chainId);
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
      config.oneinchApiKey,
      api
    );

    // Apply filtering based on configuration
    console.log(`🔍 DEBUG: Before filtering - ${processedTokens.length} tokens processed`);
    const filteredTokens = filterTokens(processedTokens, {
      minUSDValue: 0.01, // Low threshold to include valuable tokens
      maxTokensToProcess: config.maxTokensToProcess || 100,
      excludeZeroBalances: true,
    });
    console.log(`🔍 DEBUG: After filtering - ${filteredTokens.length} tokens remain`);

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
 * Iterates through all supported chains and aggregates results
 */
export async function scanTokensMultiChain(
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
  for (const chain of getSupportedChains()) {
    try {
      console.log(`🔍 Scanning ${chain.name} (${chain.id})...`);
      
      const walletSession = {
        address: session.address,
        chainId: chain.id,
        client: session.client,
        topic: session.topic,
        isDemo: session.isDemo
      };
      
      const result = await scanTokens(walletSession, config, dustThresholdUsd, api);
      
      result.chainName = chain.name;
      result.chainId = chain.id;
      
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
    }
  }
  
  return results;
}
