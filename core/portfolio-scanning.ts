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
import { formatUsdValue } from './terminal/display.js';
import type {
  WalletSession,
  TokenScanConfig,
  TokenScanResult,
  ApiImplementation,
  ScanProgress
} from './types.js';
import { DELIMITER } from './terminal/engine.js';

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
  // Environment detection
  const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
  const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
  
  // Only require API key in Node.js environment (CLI)
  // In browser, Vite proxy handles authentication
  if (!config.oneinchApiKey && isNode) {
    throw new Error('1inch API key not configured');
  }

  const chainInfo = getChainById(session.chainId);
  if (!chainInfo) {
    throw new Error(`Unsupported chain ID: ${session.chainId}`);
  }

  try {
    // Report starting phase
    config.onProgress?.({
      phase: 'starting',
      chainName: chainInfo.name,
      chainId: session.chainId,
      message: `
        \r${DELIMITER.content}
        \rStarting scan on ${chainInfo.name} (Chain ID: ${session.chainId})
      `
    });
    
    console.log(`Scanning ${chainInfo.name} for token balances...`);
    
    // Report fetching balances phase
    config.onProgress?.({
      phase: 'fetching_balances',
      chainName: chainInfo.name,
      chainId: session.chainId,
      message: `Fetching wallet balances`
    });
    
    const balanceData = await api.getWalletBalances(session.chainId, session.address, config.oneinchApiKey);
    const tokenCount = Object.keys(balanceData).length;
    
    // Report balance results
    config.onProgress?.({
      phase: 'balances_received',
      chainName: chainInfo.name,
      chainId: session.chainId,
      tokenCount,
      message: `Found ${tokenCount} tokens with balances`
    });
    
    // Report fetching metadata phase
    config.onProgress?.({
      phase: 'fetching_metadata',
      chainName: chainInfo.name,
      chainId: session.chainId,
      message: `Fetching token metadata`
    });
    
    const tokenMetadata = await api.getTokenMetadata(session.chainId, config.oneinchApiKey);
    const metadataCount = Object.keys(tokenMetadata).length;
    
    // Report metadata results
    config.onProgress?.({
      phase: 'metadata_received',
      chainName: chainInfo.name,
      chainId: session.chainId,
      metadataCount,
      message: `Loaded metadata for ${metadataCount} tokens`
    });
    
    console.log('📊 Raw balance data:', tokenCount, 'tokens found');
    console.log('📊 Token metadata:', metadataCount, 'tokens available');

    // Report processing phase
    config.onProgress?.({
      phase: 'processing',
      chainName: chainInfo.name,
      chainId: session.chainId,
      totalTokens: tokenCount,
      message: `Processing ${tokenCount} tokens`
    });

    // Process tokens and calculate USD values
    const processedTokens = await processTokenBalances(
      balanceData,
      tokenMetadata,
      session.chainId,
      config.oneinchApiKey,
      api,
      config.onProgress
    );

    // Report filtering phase
    config.onProgress?.({
      phase: 'filtering',
      chainName: chainInfo.name,
      chainId: session.chainId,
      totalTokens: processedTokens.length,
      message: `Filtering ${processedTokens.length} processed tokens`
    });

    // Apply filtering based on configuration
    console.log(`DEBUG: Before filtering - ${processedTokens.length} tokens processed`);
    const filteredTokens = filterTokens(processedTokens, {
      minUSDValue: 0.01, // Low threshold to include valuable tokens
      maxTokensToProcess: config.maxTokensToProcess || 100,
      excludeZeroBalances: true,
    });
    console.log(`DEBUG: After filtering - ${filteredTokens.length} tokens remain`);
    
    // Report filtering results
    config.onProgress?.({
      phase: 'filtering',
      chainName: chainInfo.name,
      chainId: session.chainId,
      totalTokens: filteredTokens.length,
      message: `Filtered to ${filteredTokens.length} valuable tokens`
    });

    // Categorize tokens by USD value
    const { dustTokens, mediumTokens, significantTokens } = categorizeTokens(
      filteredTokens,
      dustThresholdUsd,
      100 // Significant threshold ($100)
    );

    // Calculate portfolio stats
    const { totalUSD } = calculatePortfolioStats(filteredTokens);

    // Report completion with detailed summary
    config.onProgress?.({
      phase: 'complete',
      chainName: chainInfo.name,
      chainId: session.chainId,
      totalTokens: filteredTokens.length,
      message: `Scan complete: ${filteredTokens.length} tokens valued ${formatUsdValue(totalUSD)}`
    });

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
  // Environment detection
  const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
  const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
  
  // Only require API key in Node.js environment (CLI)
  // In browser, Vite proxy handles authentication
  if (!config.oneinchApiKey && isNode) {
    throw new Error('1inch API key not configured');
  }

  if (!session || !session.address) {
    throw new Error('No wallet session available');
  }

  const results: TokenScanResult[] = [];
  
  console.log(`🔄 Starting multichain scan for address: ${session.address}`);
  console.log(`🔄 Demo mode: ${session.isDemo ? 'Yes' : 'No'}`);
  
  // Scan tokens on all supported chains
  const chains = getSupportedChains();
  for (let i = 0; i < chains.length; i++) {
    const chain = chains[i];
    try {
      // Report chain progress
      config.onProgress?.({
        phase: 'starting',
        chainName: chain.name,
        chainId: chain.id,
        message: `Scanning chain ${i + 1}/${chains.length}: ${chain.name}...`
      });
      
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
