/**
 * Token processing module
 * Handles token data processing, filtering, and categorization logic
 */

import { formatUnits } from 'viem';
import type { TokenBalance } from './tokens.js';
import { calculateTokenUsdValue, type OneInchBalanceResponse, type OneInchTokenMetadata } from './oneinch-api.js';

/**
 * Process raw token balance data into structured TokenBalance objects
 */
export async function processTokenBalances(
  balanceData: OneInchBalanceResponse,
  tokenMetadata: OneInchTokenMetadata,
  chainId: number
): Promise<TokenBalance[]> {
  const processedTokens: TokenBalance[] = [];
  
  console.log('💰 Calculating USD values for all tokens...');
  console.log(`🔍 Processing ${Object.keys(balanceData).length} raw tokens from 1inch API...`);
  

  
  let processedForUSD = 0;
  let skippedNoMetadata = 0;
  let processedTokenCount = 0;
  let nonZeroRawBalances = 0;

  // Count non-zero raw balances first
  for (const [_, rawBalance] of Object.entries(balanceData)) {
    if (rawBalance !== '0' && !rawBalance.startsWith('0.')) {
      nonZeroRawBalances++;
    }
  }
  


  for (const [tokenAddress, rawBalance] of Object.entries(balanceData)) {
    const metadata = tokenMetadata[tokenAddress];
    if (!metadata) {
      skippedNoMetadata++;
      // Debug logging for missing metadata
      if (tokenAddress.toLowerCase().includes('bonsai') || Object.values(tokenMetadata).some(m => m.symbol?.toLowerCase().includes('bonsai'))) {
        console.log(`🔍 DEBUG: Token ${tokenAddress} has no metadata (might be BONSAI)`);
      }
      continue; // Skip tokens without metadata
    }

    const { symbol, name, decimals } = metadata;
    
    // Use viem to properly parse token balance
    const tokenBalanceRaw = rawBalance as string;
    const tokenBalanceFormatted = formatUnits(BigInt(tokenBalanceRaw), decimals);
    const tokenBalanceNum = parseFloat(tokenBalanceFormatted);
    
    processedTokenCount++;
    

    
    // Calculate USD value for ALL tokens (don't filter by token amount yet)
    // Always use ETH for pricing
    const balanceUSD = await calculateTokenUsdValue(
      tokenAddress,
      tokenBalanceNum,
      decimals,
      chainId,
      symbol
    );
    
    processedForUSD++;

    const tokenBalance: TokenBalance = {
      address: tokenAddress,
      symbol,
      name,
      decimals,
      balance: tokenBalanceRaw,
      balanceFormatted: tokenBalanceFormatted,
      balanceNum: parseFloat(tokenBalanceFormatted),
      balanceUSD,
    };

    processedTokens.push(tokenBalance);
  }

  console.log(`💰 USD calculation complete for ${processedForUSD} tokens`);
  
  return processedTokens;
}

/**
 * Filter tokens based on various criteria
 */
export function filterTokens(
  tokens: TokenBalance[],
  config: {
    minUSDValue?: number;
    maxTokensToProcess?: number;
    excludeZeroBalances?: boolean;
  } = {}
): TokenBalance[] {
  let filteredTokens = [...tokens];

  // Filter out zero balances
  if (config.excludeZeroBalances !== false) {
    filteredTokens = filteredTokens.filter(token => token.balanceNum > 0);
  }

  // Filter by minimum USD value
  if (config.minUSDValue !== undefined) {
    filteredTokens = filteredTokens.filter(token => token.balanceUSD >= config.minUSDValue!);
  }

  // Sort by USD value (descending) and limit count
  filteredTokens.sort((a, b) => b.balanceUSD - a.balanceUSD);
  
  if (config.maxTokensToProcess) {
    filteredTokens = filteredTokens.slice(0, config.maxTokensToProcess);
  }

  return filteredTokens;
}

/**
 * Categorize tokens into dust, medium, and significant tiers
 */
export function categorizeTokens(
  tokens: TokenBalance[],
  dustThreshold: number,
  mediumThreshold?: number
): {
  dustTokens: TokenBalance[];
  mediumTokens: TokenBalance[];
  significantTokens: TokenBalance[];
} {
  const actualMediumThreshold = mediumThreshold || dustThreshold;
  
  const dustTokens = tokens.filter(token => 
    token.balanceUSD > 0 && token.balanceUSD < dustThreshold
  );
  
  const mediumTokens = tokens.filter(token => 
    token.balanceUSD >= dustThreshold && token.balanceUSD < actualMediumThreshold
  );
  
  const significantTokens = tokens.filter(token => 
    token.balanceUSD >= actualMediumThreshold
  );

  return { dustTokens, mediumTokens, significantTokens };
}

/**
 * Calculate portfolio statistics
 */
export function calculatePortfolioStats(tokens: TokenBalance[]): {
  totalUSD: number;
  totalTokens: number;
  nonZeroTokens: number;
  zeroBalanceTokens: number;
} {
  const totalUSD = tokens.reduce((sum, token) => sum + token.balanceUSD, 0);
  const totalTokens = tokens.length;
  const nonZeroTokens = tokens.filter(token => token.balanceNum > 0).length;
  const zeroBalanceTokens = totalTokens - nonZeroTokens;

  return {
    totalUSD,
    totalTokens,
    nonZeroTokens,
    zeroBalanceTokens,
  };
}

/**
 * Debug logging for zero balance tokens
 */
export function logZeroBalanceTokens(
  balanceData: OneInchBalanceResponse,
  tokenMetadata: OneInchTokenMetadata,
  limit: number = 5
): void {
  const zeroBalanceTokens = Object.entries(balanceData)
    .filter(([, balance]) => balance === '0')
    .slice(0, limit);

  if (zeroBalanceTokens.length > 0) {
    console.log(`🔍 Sample zero balance tokens (${zeroBalanceTokens.length} shown):`);
    zeroBalanceTokens.forEach(([address, balance]) => {
      const metadata = tokenMetadata[address];
      const ticker = metadata?.symbol || 'UNKNOWN';
      console.log(`  - ${ticker}: ${balance} (${address})`);
    });
  }
}
