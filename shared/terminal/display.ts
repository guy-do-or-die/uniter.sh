import type { TerminalOutput } from './types.js';
import type { TokenScanResult } from '../types.js';
import { formatUnits } from 'viem';

// ============================================================================
// UNIFIED TOKEN DISPLAY FUNCTIONS
// Moved from CLI token-display.ts to provide consistent formatting across environments
// Uses Viem utilities for proper token amount formatting with tabular alignment
// ============================================================================

/**
 * Pad string to specified width for column alignment
 */
function padRight(str: string, width: number): string {
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

function padLeft(str: string, width: number): string {
  return str.length >= width ? str : ' '.repeat(width - str.length) + str;
}

/**
 * Format token display with aligned columns
 */
function formatTokenRow(index: number, symbol: string, amount: string, value: string, color: string = '37'): string {
  const indexCol = padRight(`${index}.`, 3);           // "1. " (3 chars)
  const symbolCol = padRight(symbol, 12);              // "DEGEN       " (12 chars)
  const amountCol = padLeft(amount, 18);               // "      1,461.3576" (18 chars)
  const valueCol = padLeft(value, 12);                 // "     ($4.97)" (12 chars)
  
  return `  \x1b[37m${indexCol}\x1b[0m \x1b[${color}m${symbolCol}\x1b[0m \x1b[37m${amountCol}\x1b[0m \x1b[${color}m${valueCol}\x1b[0m`;
}

/**
 * Format token amount for display using Viem utilities
 */
export function formatTokenAmount(amount: number | bigint | string, decimals: number = 18, maxDisplayDecimals: number = 6): string {
  if (amount === 0 || amount === '0' || amount === 0n) return '0';
  
  let formattedAmount: string;
  
  // Handle different input types
  if (typeof amount === 'bigint') {
    // Use Viem's formatUnits for bigint values (raw token amounts)
    formattedAmount = formatUnits(amount, decimals);
  } else if (typeof amount === 'string') {
    // Parse string to number first
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return '0';
    formattedAmount = numAmount.toString();
  } else {
    // Handle number input
    formattedAmount = amount.toString();
  }
  
  // Parse the formatted amount to apply display rules
  const numValue = parseFloat(formattedAmount);
  if (isNaN(numValue) || numValue === 0) return '0';
  
  // For very small amounts, show more precision to avoid exponential notation
  if (numValue < 0.000001) {
    const fixed = numValue.toFixed(12);
    return fixed.replace(/\.?0+$/, '') || '0';
  }
  
  // For small amounts, show appropriate precision
  if (numValue < 0.01) {
    const fixed = numValue.toFixed(8);
    return fixed.replace(/\.?0+$/, '') || '0';
  }
  
  // For amounts < 1, show up to maxDisplayDecimals
  if (numValue < 1) {
    const fixed = numValue.toFixed(Math.min(maxDisplayDecimals, 6));
    return fixed.replace(/\.?0+$/, '') || '0';
  }
  
  // For larger amounts, use locale formatting with reasonable precision
  return numValue.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(maxDisplayDecimals, 4),
  });
}

/**
 * Format USD value for display with proper precision and safeguards
 */
export function formatUsdValue(value: number | string): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Handle invalid or zero values
  if (isNaN(numValue) || numValue === 0) return '$0.00';
  
  // Safeguard against astronomical values that indicate calculation errors
  if (numValue > 1e15) {
    console.warn(`Astronomical USD value detected: ${numValue}, likely a calculation error`);
    return '$ERROR';
  }
  
  // Handle negative values
  if (numValue < 0) {
    return '-' + formatUsdValue(Math.abs(numValue));
  }
  
  // For very small USD values, show appropriate precision without exponential notation
  if (numValue < 0.000001) {
    const fixed = numValue.toFixed(8);
    const trimmed = fixed.replace(/\.?0+$/, '') || '0';
    return `$${trimmed}`;
  }
  
  if (numValue < 0.01) {
    const fixed = numValue.toFixed(6);
    const trimmed = fixed.replace(/\.?0+$/, '') || '0';
    return `$${trimmed}`;
  }
  
  // For very large values, use appropriate compact notation
  if (numValue >= 1e12) {
    return `$${(numValue / 1e12).toFixed(2)}T`;
  }
  
  if (numValue >= 1e9) {
    return `$${(numValue / 1e9).toFixed(2)}B`;
  }
  
  if (numValue >= 1e6) {
    return `$${(numValue / 1e6).toFixed(2)}M`;
  }
  
  if (numValue >= 1000) {
    return `$${(numValue / 1000).toFixed(2)}K`;
  }
  
  return `$${numValue.toFixed(2)}`;
}

/**
 * Generate unified token scan display output for both CLI and web environments
 */
export function generateTokenScanOutput(scanResult: TokenScanResult): TerminalOutput[] {
  const output: TerminalOutput[] = [];
  
  if (!scanResult || !scanResult.tokens || scanResult.tokens.length === 0) {
    output.push({
      type: 'warning',
      content: 'Scan complete - No tokens found'
    });
    return output;
  }
  
  // Portfolio summary header with colors
  output.push({
    type: 'info',
    content: '\n\x1b[36m=== PORTFOLIO SUMMARY ===\x1b[0m'
  });
  
  const totalValueFormatted = formatUsdValue(scanResult.totalUSD);
  const totalValueColored = scanResult.totalUSD > 100 ? `\x1b[32m${totalValueFormatted}\x1b[0m` : 
                           scanResult.totalUSD > 10 ? `\x1b[33m${totalValueFormatted}\x1b[0m` : 
                           `\x1b[31m${totalValueFormatted}\x1b[0m`;
  
  output.push({
    type: 'info',
    content: `Total Value: ${totalValueColored}`
  });
  output.push({
    type: 'info',
    content: `Total Tokens: \x1b[37m${scanResult.allTokens.length}\x1b[0m`
  });
  output.push({
    type: 'info',
    content: `Dust Tokens: \x1b[90m${scanResult.dustTokens.length}\x1b[0m`
  });
  
  // Display dust tokens first (most important for uniter.sh use case)
  if (scanResult.dustTokens && scanResult.dustTokens.length > 0) {
    output.push({
      type: 'info',
      content: '\n\x1b[32m▶ DUST TOKENS\x1b[0m'
    });
    
    scanResult.dustTokens.slice(0, 5).forEach((token: any, index: number) => {
      const amount = formatTokenAmount(token.balanceNum || token.balanceFormatted);
      const usdValue = formatUsdValue(token.balanceUSD || token.usdValue);
      output.push({
        type: 'info',
        content: formatTokenRow(index + 1, token.symbol, amount, `(${usdValue})`, '32')
      });
    });
    
    if (scanResult.dustTokens.length > 5) {
      output.push({
        type: 'info',
        content: `     \x1b[32m... and ${scanResult.dustTokens.length - 5} more\x1b[0m`
      });
    }
  }
  
  // Display medium tokens
  if (scanResult.mediumTokens && scanResult.mediumTokens.length > 0) {
    output.push({
      type: 'info',
      content: '\n\x1b[33m▶ MEDIUM TOKENS\x1b[0m'
    });
    
    scanResult.mediumTokens.forEach((token: any, index: number) => {
      const amount = formatTokenAmount(token.balanceNum || token.balanceFormatted);
      const usdValue = formatUsdValue(token.balanceUSD || token.usdValue);
      output.push({
        type: 'info',
        content: formatTokenRow(index + 1, token.symbol, amount, `(${usdValue})`, '33')
      });
    });
  }
  
  // Display significant tokens last (least relevant for uniter.sh)
  if (scanResult.significantTokens && scanResult.significantTokens.length > 0) {
    output.push({
      type: 'info',
      content: '\n\x1b[90m▶ SIGNIFICANT TOKENS\x1b[0m'
    });
    
    scanResult.significantTokens.forEach((token: any, index: number) => {
      const amount = formatTokenAmount(token.balanceNum || token.balanceFormatted);
      const usdValue = formatUsdValue(token.balanceUSD || token.usdValue);
      output.push({
        type: 'info',
        content: formatTokenRow(index + 1, token.symbol, amount, `(${usdValue})`, '90')
      });
    });
  }
  
  output.push({
    type: 'info',
    content: '\x1b[36m============================================================\x1b[0m'
  });
  
  return output;
}
