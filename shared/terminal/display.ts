import type { TerminalOutput } from './types.js';
import type { TokenScanResult } from '../types.js';

// ============================================================================
// UNIFIED TOKEN DISPLAY FUNCTIONS
// Moved from CLI token-display.ts to provide consistent formatting across environments
// ============================================================================

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
 * Generate unified token scan display output for both CLI and web environments
 */
export function generateTokenScanOutput(scanResult: TokenScanResult): TerminalOutput[] {
  const output: TerminalOutput[] = [];
  
  if (!scanResult || !scanResult.tokens || scanResult.tokens.length === 0) {
    output.push({
      type: 'info',
      content: 'Scan complete - No tokens found'
    });
    return output;
  }
  
  // Portfolio summary header
  output.push({
    type: 'info',
    content: '\n┌─ PORTFOLIO SUMMARY ─────────────────────────────────────┐'
  });
  output.push({
    type: 'info',
    content: `│ Total Value: ${formatUsdValue(scanResult.totalUSD).padEnd(42)} │`
  });
  output.push({
    type: 'info',
    content: `│ Total Tokens: ${scanResult.allTokens.length.toString().padEnd(40)} │`
  });
  output.push({
    type: 'info',
    content: `│ Dust Tokens: ${scanResult.dustTokens.length.toString().padEnd(41)} │`
  });
  output.push({
    type: 'info',
    content: '└─────────────────────────────────────────────────────────┘'
  });
  
  // Display significant tokens
  if (scanResult.significantTokens && scanResult.significantTokens.length > 0) {
    output.push({
      type: 'info',
      content: '\n▶ SIGNIFICANT TOKENS'
    });
    
    scanResult.significantTokens.forEach((token: any, index: number) => {
      const amount = formatTokenAmount(token.balanceNum || token.balanceFormatted);
      const usdValue = formatUsdValue(token.balanceUSD || token.usdValue);
      output.push({
        type: 'info',
        content: `  ${index + 1}. ${token.symbol} - ${amount} (${usdValue})`
      });
    });
  }
  
  // Display medium tokens
  if (scanResult.mediumTokens && scanResult.mediumTokens.length > 0) {
    output.push({
      type: 'info',
      content: '\n▶ MEDIUM TOKENS'
    });
    
    scanResult.mediumTokens.forEach((token: any, index: number) => {
      const amount = formatTokenAmount(token.balanceNum || token.balanceFormatted);
      const usdValue = formatUsdValue(token.balanceUSD || token.usdValue);
      output.push({
        type: 'info',
        content: `  ${index + 1}. ${token.symbol} - ${amount} (${usdValue})`
      });
    });
  }
  
  // Display dust tokens (sample)
  if (scanResult.dustTokens && scanResult.dustTokens.length > 0) {
    output.push({
      type: 'info',
      content: '\n▶ DUST TOKENS'
    });
    
    scanResult.dustTokens.slice(0, 5).forEach((token: any, index: number) => {
      const amount = formatTokenAmount(token.balanceNum || token.balanceFormatted);
      const usdValue = formatUsdValue(token.balanceUSD || token.usdValue);
      output.push({
        type: 'info',
        content: `  ${index + 1}. ${token.symbol} - ${amount} (${usdValue})`
      });
    });
    
    if (scanResult.dustTokens.length > 5) {
      output.push({
        type: 'info',
        content: `     ... and ${scanResult.dustTokens.length - 5} more`
      });
    }
  }
  
  output.push({
    type: 'info',
    content: '============================================================'
  });
  
  return output;
}
