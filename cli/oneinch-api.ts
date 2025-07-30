/**
 * 1inch API wrapper module
 * Handles all interactions with the 1inch API for balance and quote operations
 */

import { loadConfig } from './config.js';

// 1inch API endpoints
const ONEINCH_BASE_URL = 'https://api.1inch.dev';

// Common token addresses
export const TOKEN_ADDRESSES = {
  ETH: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  // USDC addresses by chain (for USD quotes)
  USDC: {
    1: '0xa0b86a33e6ba7b2e8c4a4b5c0b8e1b2c3d4e5f6a', // Ethereum
    137: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // Polygon
    8453: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // Base
    42161: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // Arbitrum
    10: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // Optimism
    43114: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', // Avalanche
    56: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // BSC
    100: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83', // Gnosis (USDC.e)
    59144: '0x176211869ca2b568f2a7d4ee941e073a821ee1ff', // Linea
    324: '0x1d17cbcf0d6d143135ae902365d2e5e2a16538d4', // zkSync Era
    146: '0x29219dd400f2bf60e5a23d13be72b486d4038894', // Sonic
  } as Record<number, string>,
} as const;

// API response types
export interface OneInchBalanceResponse {
  [tokenAddress: string]: string;
}

export interface OneInchTokenMetadata {
  [tokenAddress: string]: {
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
  };
}

export interface OneInchQuoteResponse {
  dstAmount: string;
  srcAmount: string;
  protocols: any[];
  gas: string;
}

/**
 * Get wallet token balances from 1inch API
 */
export async function getWalletBalances(
  chainId: number, 
  walletAddress: string
): Promise<OneInchBalanceResponse> {
  const config = loadConfig();
  if (!config.oneinchApiKey) {
    throw new Error('1inch API key not configured');
  }

  const response = await fetch(
    `${ONEINCH_BASE_URL}/balance/v1.2/${chainId}/balances/${walletAddress}`,
    {
      headers: {
        'Authorization': `Bearer ${config.oneinchApiKey}`,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`1inch Balance API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get token metadata from 1inch API
 */
export async function getTokenMetadata(chainId: number): Promise<OneInchTokenMetadata> {
  const config = loadConfig();
  if (!config.oneinchApiKey) {
    throw new Error('1inch API key not configured');
  }

  const response = await fetch(
    `${ONEINCH_BASE_URL}/token/v1.2/${chainId}`,
    {
      headers: {
        'Authorization': `Bearer ${config.oneinchApiKey}`,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`1inch Token API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get a quote for swapping one token to another
 */
export async function getTokenQuote(
  chainId: number,
  srcToken: string,
  dstToken: string,
  amount: string
): Promise<OneInchQuoteResponse | null> {
  const config = loadConfig();
  if (!config.oneinchApiKey) {
    throw new Error('1inch API key not configured');
  }

  const url = `${ONEINCH_BASE_URL}/swap/v6.0/${chainId}/quote?src=${srcToken}&dst=${dstToken}&amount=${amount}`;
  
  // Debug logging for problematic tokens
  const isUSDT = srcToken.toLowerCase() === '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';
  if (isUSDT) {
    console.log(`\n🔍 DEBUG 1inch API call for USDT:`);
    console.log(`   URL: ${url}`);
    console.log(`   Chain: ${chainId}`);
    console.log(`   Src: ${srcToken}`);
    console.log(`   Dst: ${dstToken}`);
    console.log(`   Amount: ${amount}`);
  }

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${config.oneinchApiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (isUSDT) {
        console.log(`   ❌ API Error: ${response.status} ${response.statusText}`);
      }
      return null;
    }

    const result = await response.json();
    
    if (isUSDT) {
      console.log(`   ✅ API Response:`, JSON.stringify(result, null, 2));
    }
    
    return result;
  } catch (error) {
    if (isUSDT) {
      console.log(`   ❌ Network Error:`, error);
    }
    return null; // Network error or other issues
  }
}

// Cache for ETH/USDC price per chain
const ethUsdPriceCache: Record<number, number> = {};

/**
 * Get ETH price in USD for a specific chain using ETH/USDC quote
 */
export async function getEthPriceUsd(chainId: number): Promise<number> {
  // Return cached price if available
  if (ethUsdPriceCache[chainId]) {
    return ethUsdPriceCache[chainId];
  }

  // Get USDC address for this chain
  const usdcAddress = TOKEN_ADDRESSES.USDC[chainId];
  if (!usdcAddress) {
    console.log(`⚠️  No USDC address for chain ${chainId}, using fallback ETH price`);
    return 3400; // Fallback price
  }

  // Quote 1 ETH to USDC
  const oneEthWei = '1000000000000000000'; // 1 ETH in wei
  const quote = await getTokenQuote(chainId, TOKEN_ADDRESSES.ETH, usdcAddress, oneEthWei);
  
  if (!quote) {
    console.log(`⚠️  No ETH/USDC quote for chain ${chainId}, using fallback price`);
    return 3400; // Fallback price
  }

  // USDC has 6 decimals
  const usdcReceived = parseFloat(quote.dstAmount) / 1e6;
  const ethPriceUsd = usdcReceived;
  
  console.log(`💱 ETH price on chain ${chainId}: $${ethPriceUsd.toFixed(2)}`);
  
  // Cache the price
  ethUsdPriceCache[chainId] = ethPriceUsd;
  return ethPriceUsd;
}

/**
 * Calculate USD value using ETH as base currency
 * Get ETH/USDC price once, then quote tokens to ETH and multiply
 */
export async function calculateTokenUsdValue(
  tokenAddress: string,
  tokenBalance: number,
  tokenDecimals: number,
  chainId: number,
  tokenSymbol?: string
): Promise<number> {
  if (tokenBalance === 0) return 0;
  
  // Get ETH price in USD for this chain
  const ethPriceUsd = await getEthPriceUsd(chainId);

  // Handle ETH directly
  if (tokenAddress.toLowerCase() === TOKEN_ADDRESSES.ETH.toLowerCase()) {
    return tokenBalance * ethPriceUsd;
  }

  // For other tokens, quote to ETH first
  const quoteAmount = Math.min(tokenBalance, 0.01); // Small amount to minimize slippage
  const quoteAmountWei = Math.floor(quoteAmount * Math.pow(10, tokenDecimals)).toString();
  
  if (quoteAmountWei === '0') {
    return 0; // Amount too small
  }
  
  const quote = await getTokenQuote(chainId, tokenAddress, TOKEN_ADDRESSES.ETH, quoteAmountWei);
  
  if (!quote) {
    return 0; // No liquidity
  }
  
  // Calculate ETH value for the quoted amount
  const ethReceivedWei = parseFloat(quote.dstAmount);
  const ethReceived = ethReceivedWei / 1e18;
  const ethPerToken = ethReceived / quoteAmount;
  
  // Calculate total ETH value for full balance
  const totalEthValue = tokenBalance * ethPerToken;
  
  // Convert to USD using the ETH price
  const totalUsdValue = totalEthValue * ethPriceUsd;
  
  return totalUsdValue;
}
