/**
 * Portfolio Display and Output Formatting
 * Single responsibility: Handle output formatting, console suppression, and display functions
 */

import { getSupportedChains } from './chains.js';
import { formatUsdValue, generateTokenScanOutput } from './terminal/display.js';
import { scanTokens } from './portfolio-scanning.js';
import * as defaultApi from './api.js';
import type {
  WalletSession,
  TokenScanConfig,
  TokenScanResult,
  UnifiedScanResult,
  MultiChainScanResult,
  OutputItem
} from './types.js';

/**
 * Unified scan function with formatted output - used by both CLI and web
 * Suppresses console output and returns formatted terminal output
 */
export async function unifiedScan(
  session: WalletSession,
  apiKey: string,
  dustThresholdUsd: number = 5,
  onProgress?: (progress: any) => void
): Promise<UnifiedScanResult> {
  const config: TokenScanConfig = {
    oneinchApiKey: apiKey,
    maxTokensToProcess: 1000,
    excludeTokens: [],
    defaultMinUsdValue: dustThresholdUsd,
    onProgress: onProgress ? (progress: any) => {
      // Temporarily restore console for progress updates
      const tempConsole = console.log;
      console.log = originalConsole.log;
      onProgress(progress);
      console.log = tempConsole;
    } : undefined
  };

  // Create unified API implementation
  const unifiedApi = {
    getWalletBalances: defaultApi.getWalletBalances,
    getTokenMetadata: defaultApi.getTokenMetadata,
    getQuote: defaultApi.getQuote,
    findUsdcAddress: defaultApi.findUsdcAddress,
    getSwap: defaultApi.getSwap,
    canSwapToken: defaultApi.canSwapToken,
    getApproveTransaction: defaultApi.getApproveTransaction,
    getCurrentAllowance: defaultApi.getCurrentAllowance,
    getSpenderAddress: defaultApi.getSpenderAddress
  };

  // Suppress console output during scan
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  };

  // Suppress console output during scan to show clean progress updates
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  console.info = () => {};

  try {
    const result = await scanTokens(session, config, dustThresholdUsd, unifiedApi);
    const output = generateTokenScanOutput(result);
    
    return { result, output };
  } finally {
    // Restore console
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
  }
}


export function aggregatedResult(dustThresholdUsd: number, results: TokenScanResult[]): TokenScanResult {
  const allTokensAggregated: any[] = [];
  let totalValue = 0;
  
  results.forEach(result => {
    // Add chain identifier to each token for reference
    const tokensWithChain = result.allTokens.map(token => ({
      ...token,
      chainName: result.chainName,
      chainId: result.chainId
    }));
    allTokensAggregated.push(...tokensWithChain);
    totalValue += result.totalUSD;
  });
  
  // Sort all tokens by USD value (descending)
  allTokensAggregated.sort((a, b) => (b.balanceUSD || b.usdValue || 0) - (a.balanceUSD || a.usdValue || 0));
  
  // Create aggregated scan result for unified categorized display
  const aggregatedResult: TokenScanResult = {
    tokens: allTokensAggregated,
    nativeTokens: allTokensAggregated.filter(t => t.isNative),
    allTokens: allTokensAggregated,
    dustTokens: allTokensAggregated.filter(t => (t.balanceUSD || t.usdValue || 0) < dustThresholdUsd),
    mediumTokens: allTokensAggregated.filter(t => {
      const value = t.balanceUSD || t.usdValue || 0;
      return value >= dustThresholdUsd && value < 100;
    }),
    significantTokens: allTokensAggregated.filter(t => (t.balanceUSD || t.usdValue || 0) >= 100),
    totalUSD: totalValue,
    chainId: 0, // Multi-chain
    chainName: 'Multi-Chain Portfolio'
  }; 

  return aggregatedResult;
}


/**
 * Unified multi-chain scan with formatted output
 * Orchestrates multi-chain scanning and provides formatted output for display
 */
export async function scanMultichain(
  session: WalletSession,
  apiKey: string,
  dustThresholdUsd: number = 5,
  onProgress?: (progress: any) => void
): Promise<MultiChainScanResult> {
  const results: TokenScanResult[] = [];
 
  for (const chain of getSupportedChains()) {
    try {
      const chainSession: WalletSession = {
        ...session,
        chainId: chain.id
      };
      
      const { result } = await unifiedScan(chainSession, apiKey, dustThresholdUsd, onProgress);
      
      if (result.allTokens.length > 0) {
        results.push(result);
      } 
    } catch (error) {
      console.log(error)
    }
  }

  // Aggregate all tokens from all chains into unified summary
  if (results.length > 0) {    
    // Add chain breakdown summary at the end
    console.log(`⛓️  Scanned ${results.length} chains successfully`);
  } else {
    console.log('❌ No chains scanned successfully');
  }
  
  return { results, output: [] };
}

/**
 * CLI display function - converts output to console.log
 */
export function displayForCLI(output: OutputItem[]): void {
  output.forEach(item => console.log(item.content));
}

/**
 * Web display function - returns output for terminal UI
 */
export function displayForWeb(output: OutputItem[]): OutputItem[] {
  return output;
}
