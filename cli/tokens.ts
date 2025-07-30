/**
 * Token scanning and management functionality
 * Integrates with 1inch API to fetch wallet token balances and metadata
 * Refactored for SOLID principles and maintainability
 */

import { loadConfig } from './config.js';
import { SUPPORTED_CHAINS } from './chains.js';
import type { WalletSession } from './wallet.js';
import { getWalletBalances, getTokenMetadata } from './oneinch-api.js';
import { processTokenBalances, filterTokens, categorizeTokens, calculatePortfolioStats, logZeroBalanceTokens } from './token-processor.js';
import { displayTokens as displayTokenResults } from './token-display.js';

// Token balance interface
export interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string; // Raw balance from API
  balanceFormatted: string; // Human-readable balance
  balanceNum: number; // Numeric balance for calculations
  balanceUSD: number; // USD value
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
}

/**
 * Main token scanning function
 * @param session - WalletConnect session
 * @param dustThresholdUsd - Maximum USD value for dust tokens (default: $5)
 */
export async function scanTokens(
  session: WalletSession, 
  dustThresholdUsd: number = 5
): Promise<TokenScanResult> {
  const config = loadConfig();
  if (!config.oneinchApiKey) {
    throw new Error('1inch API key not configured');
  }

  const chainInfo = SUPPORTED_CHAINS.find(c => c.id === session.chainId);
  if (!chainInfo) {
    throw new Error(`Unsupported chain ID: ${session.chainId}`);
  }

  try {
    console.log(`🔄 Scanning ${chainInfo.name} for token balances...`);
    
    // Fetch data from 1inch API
    const [balanceData, tokenMetadata] = await Promise.all([
      getWalletBalances(session.chainId, session.address),
      getTokenMetadata(session.chainId)
    ]);
    
    console.log('📊 Raw balance data:', Object.keys(balanceData).length, 'tokens found');
    console.log('📊 Token metadata:', Object.keys(tokenMetadata).length, 'tokens available');

    // Process tokens and calculate USD values
    const processedTokens = await processTokenBalances(
      balanceData,
      tokenMetadata,
      session.chainId
    );

    // Apply filtering based on configuration
    // Use a low threshold for filtering (0.01) to include all valuable tokens
    // Higher thresholds are used only for categorization, not filtering
    const filteredTokens = filterTokens(processedTokens, {
      minUSDValue: 0.01, // Low threshold to include tokens like KAITO ($2.33) and CLANKER ($1.99)
      maxTokensToProcess: config.maxTokensToProcess || 100,
      excludeZeroBalances: true,
    });

    // Categorize tokens
    const mediumThreshold = config.defaultMinUsdValue || dustThresholdUsd;
    const { dustTokens, mediumTokens, significantTokens } = categorizeTokens(
      filteredTokens,
      dustThresholdUsd,
      mediumThreshold
    );

    // Calculate portfolio statistics
    const { totalUSD } = calculatePortfolioStats(filteredTokens);

    // Display results
    console.log('✅ Token scan complete!');
    console.log(`💰 Total portfolio value: $${totalUSD.toFixed(2)}`);
    console.log(`🪙 Total tokens processed: ${filteredTokens.length}`);
    console.log(`🧹 Dust tokens (< $${dustThresholdUsd}): ${dustTokens.length}`);
    
    if (mediumTokens.length > 0) {
      console.log(`🔸 Medium tokens ($${dustThresholdUsd}-$${mediumThreshold}): ${mediumTokens.length}`);
    }
    
    console.log(`💎 Significant tokens (>= $${mediumThreshold}): ${significantTokens.length}`);
    console.log(`🔍 Filtered: ${processedTokens.length - filteredTokens.length} tokens excluded by advanced filters`);

    // Debug: Show sample zero balance tokens
    logZeroBalanceTokens(balanceData, tokenMetadata, 5);

    return {
      allTokens: filteredTokens,
      dustTokens,
      mediumTokens,
      significantTokens,
      totalUSD,
      chainId: session.chainId,
      chainName: chainInfo.name,
    };

  } catch (error) {
    console.error('❌ Error scanning tokens:', (error as Error).message);
    throw error;
  }
}

/**
 * Display tokens in a user-friendly format
 * @deprecated Use displayTokens from token-display.ts instead
 */
export function displayTokens(result: TokenScanResult): void {
  return displayTokenResults(result);
}

/**
 * Scan tokens across all supported chains with clean resume output
 */
export async function scanTokensMultiChain(session: WalletSession): Promise<void> {
  const { generateMultichainSummary, displayMultichainResume, displayTopDustTokens } = await import('./resume.js');
  
  console.log('🌐 Starting multi-chain token scan...');
  
  // All SUPPORTED_CHAINS are compatible with 1inch API
  const compatibleChains = SUPPORTED_CHAINS.map(chain => ({
    name: chain.name,
    id: chain.id
  }));
  
  console.log(`📡 Scanning ${compatibleChains.length} compatible chains...`);
  
  const results: TokenScanResult[] = [];
  const failedChains: string[] = [];
  
  for (const chain of compatibleChains) {
    try {
      console.log(`🔍 Scanning ${chain.name}...`);
      
      // Create a temporary session for this chain
      const chainSession: WalletSession = {
        ...session,
        chainId: chain.id
      };
      
      // Scan tokens quietly (suppress individual chain output)
      const originalLog = console.log;
      console.log = () => {}; // Temporarily suppress console.log
      
      try {
        const result = await scanTokens(chainSession);
        results.push(result);
      } finally {
        console.log = originalLog; // Restore console.log
      }
      
      console.log(`✅ ${chain.name} complete`);
      
    } catch (error) {
      console.warn(`⚠️ Failed to scan ${chain.name}: ${(error as Error).message}`);
      failedChains.push(chain.name);
    }
  }
  
  // Generate and display the clean resume
  if (results.length > 0) {
    const summary = generateMultichainSummary(results);
    displayMultichainResume(summary);
    
    // Show top dust tokens for detailed review
    if (summary.totalDustTokens > 0) {
      displayTopDustTokens(results, 10);
    }
  } else {
    console.log('❌ No chains scanned successfully');
  }
  
  if (failedChains.length > 0) {
    console.log(`\n⚠️ Failed to scan: ${failedChains.join(', ')}`);
  }
}
