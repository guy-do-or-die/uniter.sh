import { getCurrentSession } from './wallet.js';
import { loadConfig } from './config.js';
import { SUPPORTED_CHAINS } from './chains.js';

export interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceUSD: number;
  chainId: number;
  chainName: string;
  logoURI?: string;
}

export interface TokenScanResult {
  totalUSD: number;
  totalTokens: number;
  tokens: TokenBalance[];
  dustTokens: TokenBalance[];
}

/**
 * Get token balances for connected wallet using 1inch API
 */
export async function scanTokens(sessionOverride?: { address: string; chainId: number }): Promise<TokenScanResult> {
  const session = sessionOverride || getCurrentSession();
  if (!session) {
    throw new Error('No wallet connected. Please connect your wallet first.');
  }

  const config = loadConfig();
  if (!config.oneinchApiKey) {
    throw new Error('1inch API key is required. Please set ONEINCH_API_KEY in your environment variables.');
  }

  console.log('🔍 Scanning tokens for wallet:', session.address);
  console.log('⛓️ Chain ID:', session.chainId);

  const allTokens: TokenBalance[] = [];
  let totalUSD = 0;

  // For now, scan the current chain only
  // TODO: Extend to scan multiple chains
  const chainInfo = SUPPORTED_CHAINS.find(c => c.id === session.chainId);
  if (!chainInfo) {
    throw new Error(`Unsupported chain ID: ${session.chainId}`);
  }

  try {
    console.log(`🔄 Scanning ${chainInfo.name} for token balances...`);
    
    // Use 1inch API to get token balances
    const response = await fetch(
      `https://api.1inch.dev/balance/v1.2/${session.chainId}/balances/${session.address}`,
      {
        headers: {
          'Authorization': `Bearer ${config.oneinchApiKey}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`1inch API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📊 Raw balance data:', Object.keys(data).length, 'tokens found');

    // Process token balances
    for (const [tokenAddress, balanceData] of Object.entries(data)) {
      const balance = balanceData as any;
      
      if (!balance.symbol || !balance.decimals) {
        continue; // Skip invalid tokens
      }

      const tokenBalance: TokenBalance = {
        address: tokenAddress,
        symbol: balance.symbol,
        name: balance.name || balance.symbol,
        decimals: balance.decimals,
        balance: balance.balance,
        balanceUSD: parseFloat(balance.balanceUSD || '0'),
        chainId: session.chainId,
        chainName: chainInfo.name,
        logoURI: balance.logoURI,
      };

      allTokens.push(tokenBalance);
      totalUSD += tokenBalance.balanceUSD;
    }

    // Sort tokens by USD value (descending)
    allTokens.sort((a, b) => b.balanceUSD - a.balanceUSD);

    // Identify dust tokens (less than minimum USD value)
    const minUSDValue = config.defaultMinUsdValue || 5;
    const dustTokens = allTokens.filter(token => token.balanceUSD < minUSDValue && token.balanceUSD > 0);
    const significantTokens = allTokens.filter(token => token.balanceUSD >= minUSDValue);

    console.log('✅ Token scan complete!');
    console.log(`💰 Total portfolio value: $${totalUSD.toFixed(2)}`);
    console.log(`🪙 Total tokens found: ${allTokens.length}`);
    console.log(`🧹 Dust tokens (< $${minUSDValue}): ${dustTokens.length}`);
    console.log(`💎 Significant tokens (>= $${minUSDValue}): ${significantTokens.length}`);

    return {
      totalUSD,
      totalTokens: allTokens.length,
      tokens: allTokens,
      dustTokens,
    };

  } catch (error) {
    console.error('❌ Error scanning tokens:', error);
    throw error;
  }
}

/**
 * Display token balances in a user-friendly format
 */
export function displayTokens(scanResult: TokenScanResult): void {
  const { totalUSD, totalTokens, tokens, dustTokens } = scanResult;

  console.log('\n' + '='.repeat(60));
  console.log('🪙 TOKEN PORTFOLIO SUMMARY');
  console.log('='.repeat(60));
  console.log(`💰 Total Value: $${totalUSD.toFixed(2)}`);
  console.log(`🔢 Total Tokens: ${totalTokens}`);
  console.log(`🧹 Dust Tokens: ${dustTokens.length}`);
  console.log('='.repeat(60));

  if (tokens.length === 0) {
    console.log('📭 No tokens found in this wallet');
    return;
  }

  // Display significant tokens
  const significantTokens = tokens.filter(t => !dustTokens.includes(t));
  if (significantTokens.length > 0) {
    console.log('\n💎 SIGNIFICANT TOKENS:');
    significantTokens.forEach((token, index) => {
      const emoji = getTokenEmoji(token.symbol);
      const balanceFormatted = formatTokenBalance(token.balance, token.decimals);
      console.log(`${index + 1}. ${emoji} ${token.symbol} - ${balanceFormatted} ($${token.balanceUSD.toFixed(2)})`);
    });
  }

  // Display dust tokens
  if (dustTokens.length > 0) {
    console.log('\n🧹 DUST TOKENS (potential for cleanup):');
    dustTokens.forEach((token, index) => {
      const emoji = getTokenEmoji(token.symbol);
      const balanceFormatted = formatTokenBalance(token.balance, token.decimals);
      console.log(`${index + 1}. ${emoji} ${token.symbol} - ${balanceFormatted} ($${token.balanceUSD.toFixed(2)})`);
    });
  }

  console.log('='.repeat(60));
}

/**
 * Get emoji for token symbol
 */
function getTokenEmoji(symbol: string): string {
  const emojiMap: Record<string, string> = {
    'ETH': '💎',
    'WETH': '💎',
    'BTC': '₿',
    'WBTC': '₿',
    'USDC': '💵',
    'USDT': '💵',
    'DAI': '💵',
    'MATIC': '🟣',
    'LINK': '🔗',
    'UNI': '🦄',
    'AAVE': '👻',
    'COMP': '🏛️',
    'MKR': '🏗️',
    'SNX': '⚡',
    'YFI': '🔥',
    'SUSHI': '🍣',
    'CRV': '📈',
    'BAL': '⚖️',
    'LDO': '🌊',
  };

  return emojiMap[symbol.toUpperCase()] || '🪙';
}

/**
 * Format token balance for display
 */
function formatTokenBalance(balance: string, decimals: number): string {
  const balanceNum = parseFloat(balance) / Math.pow(10, decimals);
  
  if (balanceNum >= 1000000) {
    return (balanceNum / 1000000).toFixed(2) + 'M';
  } else if (balanceNum >= 1000) {
    return (balanceNum / 1000).toFixed(2) + 'K';
  } else if (balanceNum >= 1) {
    return balanceNum.toFixed(4);
  } else {
    return balanceNum.toFixed(6);
  }
}
