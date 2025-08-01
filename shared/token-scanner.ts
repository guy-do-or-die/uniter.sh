/**
 * TRULY UNIFIED TOKEN SCANNER
 * Single function used by both CLI and web with identical behavior
 */

import { generateTokenScanOutput } from './engine.js';
import { getWalletBalances, getTokenMetadata, getQuote, findUsdcAddress } from './api.js';
import { getSupportedChains } from './chains.js';

import { TokenScanConfig, TokenScanResult, WalletSession, scanTokens } from './scanner.js';

/**
 * The ONE AND ONLY scan function used by both CLI and web
 * Returns formatted terminal output - no console.log, no side effects
 */
export async function unifiedScan(
  session: WalletSession,
  apiKey: string,
  dustThresholdUsd: number = 5
): Promise<{
  result: TokenScanResult;
  output: Array<{ type: string; content: string }>;
}> {
  // Create config
  const config: TokenScanConfig = {
    oneinchApiKey: apiKey,
    maxTokensToProcess: 1000,
    excludeTokens: [],
    defaultMinUsdValue: dustThresholdUsd
  };

  // Create unified API implementation (same for both environments)
  const unifiedApi = {
    getWalletBalances: async (chainId: number, address: string, apiKey: string) => {
      return getWalletBalances(chainId, address, apiKey);
    },
    getTokenMetadata: async (chainId: number, apiKey: string) => {
      return getTokenMetadata(chainId, apiKey);
    },
    getQuote: async (chainId: number, fromToken: string, toToken: string, amount: string, apiKey: string) => {
      return getQuote(chainId, fromToken, toToken, amount, apiKey);
    },
    findUsdcAddress: async (chainId: number, apiKey: string, fetchFn: typeof fetch) => {
      return findUsdcAddress(chainId, apiKey, fetchFn);
    }
  };

  // Suppress ALL console output during scan
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  };

  // Completely silent scan
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  console.info = () => {};

  try {
    // Perform scan with no output
    const result = await scanTokens(session, config, dustThresholdUsd, unifiedApi);
    
    // Generate formatted output
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

/**
 * UNIFIED MULTI-CHAIN SCANNER
 * Single function used by both CLI and web for multi-chain scanning
 */
export async function scanMultichain(
  session: WalletSession,
  apiKey: string,
  dustThresholdUsd: number = 5
): Promise<{
  results: TokenScanResult[];
  output: Array<{ type: string; content: string }>;
}> {
  const results: TokenScanResult[] = [];
  const output: Array<{ type: string; content: string }> = [];
  
  // Add header
  output.push({
    type: 'info',
    content: '🌐 Starting multi-chain token scan...'
  });
  
  // Scan each supported chain
  for (const chain of getSupportedChains()) {
    try {
      output.push({
        type: 'info',
        content: `🔄 Scanning ${chain.name} (${chain.id})...`
      });
      
      // Create session for this chain
      const chainSession: WalletSession = {
        ...session,
        chainId: chain.id
      };
      
      // Use the unified single-chain scanner
      const { result } = await unifiedScan(chainSession, apiKey, dustThresholdUsd);
      
      if (result.allTokens.length > 0) {
        results.push(result);
        
        // Add chain summary to output
        const chainOutput = generateTokenScanOutput(result);
        output.push(...chainOutput);
      } else {
        output.push({
          type: 'info',
          content: `ℹ️ No tokens found on ${chain.name}`
        });
      }
    } catch (error) {
      output.push({
        type: 'error',
        content: `❌ Error scanning ${chain.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  // Add multi-chain summary
  if (results.length > 0) {
    const totalValue = results.reduce((sum, r) => sum + r.totalUSD, 0);
    const totalTokens = results.reduce((sum, r) => sum + r.allTokens.length, 0);
    
    output.push(
      { type: 'info', content: '' },
      { type: 'info', content: '🌐 Multi-Chain Summary:' },
      { type: 'info', content: `💰 Total Portfolio Value: $${totalValue.toFixed(2)}` },
      { type: 'info', content: `🪙 Total Tokens: ${totalTokens}` },
      { type: 'info', content: `⛓️ Chains Scanned: ${results.length}` }
    );
  } else {
    output.push({
      type: 'error',
      content: '❌ No chains scanned successfully'
    });
  }
  
  return { results, output };
}

/**
 * CLI display function - converts output to console.log
 */
export function displayForCLI(output: Array<{ type: string; content: string }>): void {
  output.forEach(item => console.log(item.content));
}

/**
 * Web display function - returns output for terminal UI
 */
export function displayForWeb(output: Array<{ type: string; content: string }>): Array<{ type: string; content: string }> {
  return output;
}
