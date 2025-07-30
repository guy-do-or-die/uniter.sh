/**
 * Token display module
 * Handles formatting and displaying token information to the user
 */

import type { TokenBalance, TokenScanResult } from './tokens.js';

/**
 * Format token amount for display
 */
export function formatTokenAmount(amount: number, maxDecimals: number = 4): string {
  if (amount === 0) return '0';
  
  // For very small amounts, show more decimals
  if (amount < 0.001) {
    return amount.toExponential(2);
  }
  
  // For amounts < 1, show up to 6 decimals
  if (amount < 1) {
    return amount.toFixed(Math.min(6, maxDecimals));
  }
  
  // For larger amounts, use locale formatting
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Format USD value for display
 */
export function formatUsdValue(value: number): string {
  if (value === 0) return '$0.00';
  
  if (value < 0.01) {
    return `$${value.toExponential(2)}`;
  }
  
  return `$${value.toFixed(2)}`;
}

/**
 * Display individual token information
 */
export function displayToken(token: TokenBalance, index?: number): void {
  const amount = formatTokenAmount(token.balanceNum);
  const usdValue = formatUsdValue(token.balanceUSD);
  
  const prefix = index !== undefined ? `${index}. ` : '';
  console.log(`${prefix}${token.symbol} - ${amount} (${usdValue})`);
}

/**
 * Display portfolio summary
 */
export function displayPortfolioSummary(result: TokenScanResult): void {
  console.log('\n============================================================');
  console.log('🪙 TOKEN PORTFOLIO SUMMARY');
  console.log('============================================================');
  console.log(`💰 Total Value: ${formatUsdValue(result.totalUSD)}`);
  console.log(`🔢 Total Tokens: ${result.allTokens.length}`);
  console.log(`🧹 Dust Tokens: ${result.dustTokens.length}`);
  console.log('============================================================\n');
}

/**
 * Display categorized tokens
 */
export function displayCategorizedTokens(result: TokenScanResult): void {
  // Display significant tokens
  if (result.significantTokens.length > 0) {
    console.log('💎 SIGNIFICANT TOKENS:');
    result.significantTokens.forEach((token, index) => {
      displayToken(token, index + 1);
    });
  }
  
  // Display medium tokens
  if (result.mediumTokens.length > 0) {
    console.log('\n🔸 MEDIUM TOKENS:');
    result.mediumTokens.forEach((token, index) => {
      displayToken(token, index + 1);
    });
  }
  
  // Display dust tokens (limited to first few)
  if (result.dustTokens.length > 0) {
    console.log('\n🧹 DUST TOKENS (sample):');
    result.dustTokens.slice(0, 5).forEach((token, index) => {
      displayToken(token, index + 1);
    });
    
    if (result.dustTokens.length > 5) {
      console.log(`   ... and ${result.dustTokens.length - 5} more dust tokens`);
    }
  }
}

/**
 * Display filtering statistics
 */
export function displayFilteringStats(
  totalProcessed: number,
  filteredCount: number,
  dustCount: number,
  mediumCount: number,
  significantCount: number,
  dustThreshold: number,
  mediumThreshold: number
): void {
  console.log(`🔍 Filtered to ${filteredCount} tokens after USD-based filtering`);
  console.log(`🧹 Dust tokens (< $${dustThreshold}): ${dustCount}`);
  
  if (mediumCount > 0) {
    console.log(`🔸 Medium tokens ($${dustThreshold}-$${mediumThreshold}): ${mediumCount}`);
  }
  
  console.log(`💎 Significant tokens (>= $${mediumThreshold}): ${significantCount}`);
  console.log(`🔍 Filtered: ${totalProcessed - filteredCount} tokens excluded by advanced filters`);
}

/**
 * Main display function for token scan results
 */
export function displayTokens(result: TokenScanResult): void {
  displayPortfolioSummary(result);
  displayCategorizedTokens(result);
  console.log('============================================================');
}
