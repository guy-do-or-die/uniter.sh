/**
 * Resume/Summary functionality for multichain token scans
 * Provides clean, actionable summaries before swaps
 */

import chalk from 'chalk';
import type { TokenScanResult } from './tokens.js';

export interface MultichainSummary {
  totalChains: number;
  totalValue: number;
  totalDustTokens: number;
  totalSignificantTokens: number;
  dustValue: number;
  significantValue: number;
  chainResults: ChainSummary[];
}

export interface ChainSummary {
  chainName: string;
  chainId: number;
  totalValue: number;
  dustTokens: number;
  significantTokens: number;
  dustValue: number;
  significantValue: number;
}

/**
 * Generate a multichain summary from individual chain scan results
 */
export function generateMultichainSummary(results: TokenScanResult[]): MultichainSummary {
  const chainResults: ChainSummary[] = results.map(result => {
    const dustValue = result.dustTokens.reduce((sum, token) => sum + token.balanceUSD, 0);
    const significantValue = result.significantTokens.reduce((sum, token) => sum + token.balanceUSD, 0);
    
    return {
      chainName: result.chainName,
      chainId: result.chainId,
      totalValue: result.totalUSD,
      dustTokens: result.dustTokens.length,
      significantTokens: result.significantTokens.length,
      dustValue,
      significantValue,
    };
  });

  const totalValue = chainResults.reduce((sum, chain) => sum + chain.totalValue, 0);
  const totalDustTokens = chainResults.reduce((sum, chain) => sum + chain.dustTokens, 0);
  const totalSignificantTokens = chainResults.reduce((sum, chain) => sum + chain.significantTokens, 0);
  const dustValue = chainResults.reduce((sum, chain) => sum + chain.dustValue, 0);
  const significantValue = chainResults.reduce((sum, chain) => sum + chain.significantValue, 0);

  return {
    totalChains: results.length,
    totalValue,
    totalDustTokens,
    totalSignificantTokens,
    dustValue,
    significantValue,
    chainResults: chainResults.filter(chain => chain.totalValue > 0), // Only show chains with tokens
  };
}

/**
 * Display a clean, actionable resume of the multichain scan
 */
export function displayMultichainResume(summary: MultichainSummary): void {
  console.log('\n' + '='.repeat(60));
  console.log(chalk.cyan.bold('🎯 MULTICHAIN PORTFOLIO RESUME'));
  console.log('='.repeat(60));

  // Overall stats
  console.log(chalk.white.bold('\n📊 PORTFOLIO OVERVIEW'));
  console.log(chalk.blue(`💰 Total Value: ${chalk.green.bold('$' + summary.totalValue.toFixed(2))}`));
  console.log(chalk.blue(`⛓️  Active Chains: ${chalk.yellow.bold(summary.chainResults.length)} of ${summary.totalChains}`));
  console.log(chalk.blue(`🪙 Total Tokens: ${chalk.yellow.bold(summary.totalDustTokens + summary.totalSignificantTokens)}`));

  // Dust vs Significant breakdown
  console.log(chalk.white.bold('\n🧹 DUST ANALYSIS'));
  if (summary.totalDustTokens > 0) {
    console.log(chalk.red(`🧹 Dust Tokens: ${chalk.bold(summary.totalDustTokens)} tokens worth ${chalk.bold('$' + summary.dustValue.toFixed(2))}`));
    console.log(chalk.gray(`   └─ Average dust value: $${(summary.dustValue / summary.totalDustTokens).toFixed(2)} per token`));
  } else {
    console.log(chalk.green('✨ No dust tokens found! Your portfolio is clean.'));
  }

  if (summary.totalSignificantTokens > 0) {
    console.log(chalk.green(`💎 Significant Holdings: ${chalk.bold(summary.totalSignificantTokens)} tokens worth ${chalk.bold('$' + summary.significantValue.toFixed(2))}`));
  }

  // Per-chain breakdown (only chains with tokens)
  if (summary.chainResults.length > 0) {
    console.log(chalk.white.bold('\n⛓️  CHAIN BREAKDOWN'));
    
    // Sort chains by total value (highest first)
    const sortedChains = [...summary.chainResults].sort((a, b) => b.totalValue - a.totalValue);
    
    sortedChains.forEach(chain => {
      const chainIcon = getChainIcon(chain.chainName);
      const valueColor = chain.totalValue >= 100 ? chalk.green : chain.totalValue >= 10 ? chalk.yellow : chalk.gray;
      
      console.log(`${chainIcon} ${chalk.bold(chain.chainName)}: ${valueColor('$' + chain.totalValue.toFixed(2))}`);
      
      if (chain.dustTokens > 0) {
        console.log(`   🧹 ${chain.dustTokens} dust tokens ($${chain.dustValue.toFixed(2)})`);
      }
      if (chain.significantTokens > 0) {
        console.log(`   💎 ${chain.significantTokens} significant tokens ($${chain.significantValue.toFixed(2)})`);
      }
    });
  }

  // Action recommendations
  console.log(chalk.white.bold('\n🎯 RECOMMENDED ACTIONS'));
  
  if (summary.totalDustTokens > 0) {
    console.log(chalk.cyan(`✅ Ready to unite ${summary.totalDustTokens} dust tokens worth $${summary.dustValue.toFixed(2)}`));
    console.log(chalk.gray('   Run: uniter.sh sweep --target USDC --confirm'));
  } else {
    console.log(chalk.green('✨ No action needed - your portfolio is already optimized!'));
  }

  if (summary.totalSignificantTokens > 0) {
    console.log(chalk.blue(`ℹ️  ${summary.totalSignificantTokens} significant tokens will be preserved`));
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * Get emoji icon for chain name
 */
function getChainIcon(chainName: string): string {
  const icons: Record<string, string> = {
    'Ethereum': '🔷',
    'Base': '🔵',
    'Arbitrum One': '🔴',
    'Polygon': '🟣',
    'Avalanche': '🔺',
    'BNB Smart Chain': '🟡',
    'OP Mainnet': '🔴',
    'Gnosis': '🟢',
    'Linea Mainnet': '⚫',
    'Sonic': '🔊',
    'ZKsync Era': '⚡',
  };
  
  return icons[chainName] || '⛓️';
}

/**
 * Display top dust tokens across all chains for detailed review
 */
export function displayTopDustTokens(results: TokenScanResult[], limit: number = 10): void {
  // Collect all dust tokens from all chains
  const allDustTokens = results.flatMap(result => 
    result.dustTokens.map(token => ({
      ...token,
      chainName: result.chainName,
      chainId: result.chainId,
    }))
  );

  if (allDustTokens.length === 0) {
    return;
  }

  // Sort by USD value (highest first)
  const sortedDust = allDustTokens.sort((a, b) => b.balanceUSD - a.balanceUSD);
  const topDust = sortedDust.slice(0, limit);

  console.log(chalk.white.bold(`\n🔍 TOP ${Math.min(limit, allDustTokens.length)} DUST TOKENS`));
  console.log('─'.repeat(60));

  topDust.forEach((token, index) => {
    const chainIcon = getChainIcon(token.chainName);
    const valueColor = token.balanceUSD >= 2 ? chalk.yellow : chalk.gray;
    
    console.log(
      `${(index + 1).toString().padStart(2)}. ${chainIcon} ${chalk.bold(token.symbol)}: ${valueColor('$' + token.balanceUSD.toFixed(2))} ` +
      `${chalk.gray('(' + token.balanceFormatted + ' on ' + token.chainName + ')')}`
    );
  });

  if (allDustTokens.length > limit) {
    console.log(chalk.gray(`... and ${allDustTokens.length - limit} more dust tokens`));
  }
}
