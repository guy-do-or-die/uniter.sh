/**
 * Platform-agnostic token processing module
 * Works in both Node.js and browser environments
 */

import { OneInchBalanceResponse, OneInchTokenMetadata, TOKEN_ADDRESSES, getQuote } from './platform-agnostic-api.js';

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

// Token filtering options
export interface TokenFilterOptions {
  minUSDValue?: number;
  maxTokensToProcess?: number;
  excludeZeroBalances?: boolean;
  excludeTokens?: string[];
}

// Cache for ETH/USDC prices by chain
const ethPriceCache: Record<number, { price: number; timestamp: number }> = {};
const CACHE_TTL = 60 * 1000; // 60 seconds

/**
 * Process token balances from 1inch API
 */
export async function processTokenBalances(
  balanceData: OneInchBalanceResponse,
  tokenMetadata: OneInchTokenMetadata,
  chainId: number,
  apiKey: string
): Promise<TokenBalance[]> {
  const tokens: TokenBalance[] = [];
  
  // Process each token balance
  for (const [address, balance] of Object.entries(balanceData)) {
    // Skip tokens with no metadata
    if (!tokenMetadata[address]) {
      continue;
    }
    
    const metadata = tokenMetadata[address];
    const decimals = metadata.decimals;
    
    // Calculate formatted balance
    const balanceNum = parseFloat(balance) / Math.pow(10, decimals);
    const balanceFormatted = balanceNum.toLocaleString(undefined, {
      maximumFractionDigits: 6,
      minimumFractionDigits: 0
    });
    
    // Create token object
    const token: TokenBalance = {
      address,
      symbol: metadata.symbol,
      name: metadata.name,
      decimals,
      balance,
      balanceFormatted,
      balanceNum,
      balanceUSD: 0 // Will be calculated later
    };
    
    tokens.push(token);
  }
  
  // Calculate USD values for all tokens
  for (const token of tokens) {
    try {
      token.balanceUSD = await calculateTokenUsdValue(token, chainId, apiKey);
    } catch (error) {
      console.warn(`⚠️ Failed to calculate USD value for ${token.symbol}:`, (error as Error).message);
      token.balanceUSD = 0;
    }
  }
  
  return tokens;
}

/**
 * Calculate USD value of a token using ETH/USDC as base quote
 */
export async function calculateTokenUsdValue(
  token: TokenBalance,
  chainId: number,
  apiKey: string
): Promise<number> {
  // If token has zero balance, return 0
  if (token.balanceNum === 0) {
    return 0;
  }
  
  try {
    // Get ETH price in USDC (cached per chain)
    const ethPriceUsd = await getEthPriceUsd(chainId, apiKey);
    
    // If token is ETH, just multiply by ETH price
    if (token.address.toLowerCase() === TOKEN_ADDRESSES.ETH.toLowerCase()) {
      return token.balanceNum * ethPriceUsd;
    }
    
    // If token is USDC, return balance directly
    if (TOKEN_ADDRESSES.USDC[chainId] && 
        token.address.toLowerCase() === TOKEN_ADDRESSES.USDC[chainId].toLowerCase()) {
      return token.balanceNum;
    }
    
    // For other tokens, get quote to ETH then multiply by ETH price
    // Use a small amount for quote to reduce slippage impact
    const quoteAmount = Math.min(0.01, token.balanceNum) * Math.pow(10, token.decimals);
    
    const quote = await getQuote(
      chainId,
      token.address,
      TOKEN_ADDRESSES.ETH,
      quoteAmount.toString(),
      apiKey
    );
    
    // Calculate token price in ETH
    const ethAmount = parseFloat(quote.dstAmount) / Math.pow(10, 18);
    const tokenAmount = parseFloat(quote.srcAmount) / Math.pow(10, token.decimals);
    const tokenPriceInEth = ethAmount / tokenAmount;
    
    // Calculate USD value
    const tokenPriceUsd = tokenPriceInEth * ethPriceUsd;
    return token.balanceNum * tokenPriceUsd;
  } catch (error) {
    console.warn(`⚠️ Failed to calculate USD value for ${token.symbol}:`, (error as Error).message);
    return 0;
  }
}

/**
 * Get ETH price in USDC (cached per chain)
 */
async function getEthPriceUsd(chainId: number, apiKey: string): Promise<number> {
  // Check cache first
  const now = Date.now();
  if (ethPriceCache[chainId] && now - ethPriceCache[chainId].timestamp < CACHE_TTL) {
    return ethPriceCache[chainId].price;
  }
  
  try {
    // Get USDC address for this chain
    const usdcAddress = TOKEN_ADDRESSES.USDC[chainId];
    if (!usdcAddress) {
      throw new Error(`No USDC address configured for chain ${chainId}`);
    }
    
    // Get quote for 1 ETH to USDC
    const quote = await getQuote(
      chainId,
      TOKEN_ADDRESSES.ETH,
      usdcAddress,
      '1000000000000000000', // 1 ETH in wei
      apiKey
    );
    
    // Calculate ETH price in USDC
    const usdcAmount = parseFloat(quote.dstAmount) / Math.pow(10, 6); // USDC has 6 decimals
    
    // Cache the result
    ethPriceCache[chainId] = {
      price: usdcAmount,
      timestamp: now
    };
    
    return usdcAmount;
  } catch (error) {
    console.warn(`⚠️ Failed to get ETH price in USDC:`, (error as Error).message);
    return 0;
  }
}

/**
 * Filter tokens based on configuration
 */
export function filterTokens(
  tokens: TokenBalance[],
  options: TokenFilterOptions
): TokenBalance[] {
  let filtered = [...tokens];
  
  // Filter out tokens with zero balances if requested
  if (options.excludeZeroBalances) {
    filtered = filtered.filter(token => token.balanceNum > 0);
  }
  
  // Filter out tokens with USD value below threshold
  if (typeof options.minUSDValue === 'number' && options.minUSDValue !== undefined) {
    const minValue = options.minUSDValue;
    filtered = filtered.filter(token => token.balanceUSD >= minValue);
  }
  
  // Filter out excluded tokens
  if (options.excludeTokens && options.excludeTokens.length > 0) {
    const excludeAddresses = options.excludeTokens.map(addr => addr.toLowerCase());
    filtered = filtered.filter(token => !excludeAddresses.includes(token.address.toLowerCase()));
  }
  
  // Sort by USD value (descending)
  filtered.sort((a, b) => b.balanceUSD - a.balanceUSD);
  
  // Limit number of tokens if requested
  if (options.maxTokensToProcess && filtered.length > options.maxTokensToProcess) {
    filtered = filtered.slice(0, options.maxTokensToProcess);
  }
  
  return filtered;
}

/**
 * Categorize tokens by USD value
 */
export function categorizeTokens(
  tokens: TokenBalance[],
  dustThresholdUsd: number = 5,
  significantThresholdUsd: number = 100
): {
  dustTokens: TokenBalance[];
  mediumTokens: TokenBalance[];
  significantTokens: TokenBalance[];
} {
  const dustTokens = tokens.filter(token => token.balanceUSD > 0 && token.balanceUSD < dustThresholdUsd);
  const mediumTokens = tokens.filter(token => token.balanceUSD >= dustThresholdUsd && token.balanceUSD < significantThresholdUsd);
  const significantTokens = tokens.filter(token => token.balanceUSD >= significantThresholdUsd);
  
  return {
    dustTokens,
    mediumTokens,
    significantTokens
  };
}

/**
 * Calculate portfolio statistics
 */
export function calculatePortfolioStats(
  tokens: TokenBalance[]
): {
  totalUSD: number;
  tokenCount: number;
} {
  const totalUSD = tokens.reduce((sum, token) => sum + token.balanceUSD, 0);
  
  return {
    totalUSD,
    tokenCount: tokens.length
  };
}

/**
 * Log tokens with zero balance (for debugging)
 */
export function logZeroBalanceTokens(tokens: TokenBalance[]): void {
  const zeroBalanceTokens = tokens.filter(token => token.balanceNum === 0);
  if (zeroBalanceTokens.length > 0) {
    console.log(`Found ${zeroBalanceTokens.length} tokens with zero balance`);
    zeroBalanceTokens.forEach(token => {
      console.log(`- ${token.symbol} (${token.address}): ${token.balance}`);
    });
  }
}
