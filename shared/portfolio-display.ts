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
    findUsdcAddress: defaultApi.findUsdcAddress
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
  const output: OutputItem[] = [];
  
  output.push({
    type: 'info',
    content: '🌐 Starting multi-chain token scan...'
  });
  
  for (const chain of getSupportedChains()) {
    try {
      output.push({
        type: 'info',
        content: `🔄 Scanning ${chain.name} (${chain.id})...`
      });
      
      const chainSession: WalletSession = {
        ...session,
        chainId: chain.id
      };
      
      const { result } = await unifiedScan(chainSession, apiKey, dustThresholdUsd, onProgress);
      
      if (result.allTokens.length > 0) {
        results.push(result);
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
      { type: 'info', content: `💰 Total Portfolio Value: ${formatUsdValue(totalValue)}` },
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
export function displayForCLI(output: OutputItem[]): void {
  output.forEach(item => console.log(item.content));
}

/**
 * Web display function - returns output for terminal UI
 */
export function displayForWeb(output: OutputItem[]): OutputItem[] {
  return output;
}
