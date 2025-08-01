/**
 * Platform-agnostic token processing module
 * Works in both Node.js and browser environments
 */

import { OneInchBalanceResponse, OneInchTokenMetadata, NATIVE_TOKEN_ADDRESS } from './api.js';
import { formatUnits } from 'viem';

import type { ApiImplementation } from './scanner.js';

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

// Per-chain native token price cache
const nativeTokenPriceCache: Record<number, { price: number; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache for native token metadata per chain
const nativeTokenMetadataCache: Record<number, { symbol: string; name: string; timestamp: number }> = {};

/**
 * Get native token metadata dynamically using 1inch API
 */
async function getNativeTokenMetadata(chainId: number, apiKey: string, api: ApiImplementation): Promise<{ symbol: string; name: string }> {
  const now = Date.now();
  
  // Check cache first
  const cached = nativeTokenMetadataCache[chainId];
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return { symbol: cached.symbol, name: cached.name };
  }
  
  try {
    // Get all token metadata for the chain
    const allTokens = await api.getTokenMetadata(chainId, apiKey);
    
    // Find the native token using the pseudo-address
    const nativeToken = allTokens[NATIVE_TOKEN_ADDRESS.toLowerCase()];
    if (!nativeToken) {
      throw new Error(`Native token not found in token list for chain ${chainId}`);
    }
    
    // Cache the result
    nativeTokenMetadataCache[chainId] = {
      symbol: nativeToken.symbol,
      name: nativeToken.name,
      timestamp: now
    };
    
    console.log(`✅ DEBUG: Found native token on chain ${chainId}: ${nativeToken.symbol} (${nativeToken.name})`);
    return { symbol: nativeToken.symbol, name: nativeToken.name };
  } catch (error) {
    console.warn(`⚠️ Failed to get native token metadata for chain ${chainId}:`, (error as Error).message);
    // Fallback to generic name
    return { symbol: 'NATIVE', name: 'Native Token' };
  }
}

/**
 * Process token balances from 1inch API
 */
export async function processTokenBalances(
  balanceData: OneInchBalanceResponse,
  tokenMetadata: OneInchTokenMetadata,
  chainId: number,
  apiKey: string,
  api: ApiImplementation
): Promise<TokenBalance[]> {
  const tokens: TokenBalance[] = [];
  
  // Process each token balance
  console.log(`🔍 DEBUG: Processing ${Object.keys(balanceData).length} token balances...`);
  console.log(`🔍 DEBUG: Metadata object keys:`, Object.keys(tokenMetadata).slice(0, 5));
  console.log(`🔍 DEBUG: Metadata object structure:`, typeof tokenMetadata);
  console.log(`🔍 DEBUG: First balance address:`, Object.keys(balanceData)[0]);
  console.log(`🔍 DEBUG: First metadata address:`, Object.keys(tokenMetadata)[0]);
  
  for (const [address, balance] of Object.entries(balanceData)) {
    console.log(`🔍 DEBUG: Processing token ${address} with balance ${balance}`);
    console.log(`🔍 DEBUG: Metadata lookup for ${address}:`, !!tokenMetadata[address]);
    
    // Skip tokens with no metadata
    if (!tokenMetadata[address]) {
      console.log(`🔍 DEBUG: Skipping ${address} - no metadata`);
      continue;
    }
    
    const metadata = tokenMetadata[address];
    const decimals = metadata.decimals;
    console.log(`🔍 DEBUG: Token ${metadata.symbol} has ${decimals} decimals`);
    
    // Calculate formatted balance using viem for precision
    const balanceNum = parseFloat(balance) / Math.pow(10, decimals);
    console.log(`🔍 DEBUG: ${metadata.symbol} balanceNum: ${balanceNum}`);
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
  console.log(`🔍 DEBUG: Processing ${tokens.length} tokens for USD values...`);
  console.log(`🔍 DEBUG: API implementation type:`, typeof api);
  console.log(`🔍 DEBUG: API methods available:`, Object.keys(api));
  console.log(`🔍 DEBUG: API key provided:`, apiKey ? 'Yes' : 'No');

  const tokensWithUsd = [];
  const failedTokens = [];
  
  for (const token of tokens) {
    console.log(`🔍 DEBUG: Processing token ${token.symbol} (${token.address})...`);
    try {
      token.balanceUSD = await calculateTokenUsdValue(token, chainId, apiKey, api);
      if (token.balanceUSD > 0) {
        console.log(`💰 ${token.symbol}: $${token.balanceUSD.toFixed(2)} (${token.balanceFormatted})`);
        tokensWithUsd.push(token);
      } else {
        console.log(`🔍 DEBUG: ${token.symbol} has $0.00 USD value`);
        failedTokens.push(token);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to calculate USD value for ${token.symbol}:`, (error as Error).message);
      console.log(`🔍 DEBUG: Error details:`, error);
      token.balanceUSD = 0;
      failedTokens.push(token);
    }
  }
  
  const tokensWithValue = tokens.filter(t => t.balanceUSD > 0);
  console.log(`📊 DEBUG: ${tokensWithValue.length} tokens have USD values, ${tokens.length - tokensWithValue.length} failed pricing`);
  
  // Show top tokens by balance (even without USD values)
  const topTokensByBalance = tokens
    .filter(t => t.balanceNum > 0)
    .sort((a, b) => b.balanceNum - a.balanceNum)
    .slice(0, 10);
  console.log(`🔝 DEBUG: Top 10 tokens by balance:`);
  topTokensByBalance.forEach((token, i) => {
    console.log(`   ${i+1}. ${token.symbol}: ${token.balanceFormatted} (USD: $${token.balanceUSD.toFixed(2)})`);
  });
  
  return tokens;
}

/**
 * Calculate USD value of a token using ETH/USDC as base quote
 */
export async function calculateTokenUsdValue(
  token: any,
  chainId: number,
  apiKey: string,
  api: ApiImplementation
): Promise<number> {
  console.log(`🔍 DEBUG: calculateTokenUsdValue called for ${token.symbol} on chain ${chainId}`);
  console.log(`🔍 DEBUG: Token balance: ${token.balance}`);
  console.log(`🔍 DEBUG: API key available: ${apiKey ? 'Yes' : 'No'}`);
  
  if (!token.balance || token.balance === '0') {
    console.log(`🔍 DEBUG: ${token.symbol} has zero balance, returning 0`);
    return 0;
  }
  
  try {
    // Get native token metadata and price for USD calculation
    const nativeTokenMetadata = await getNativeTokenMetadata(chainId, apiKey, api);
    const nativeTokenPriceUsd = await getNativeTokenPriceUsd(chainId, apiKey, api);
    console.log(`🔍 DEBUG ${token.symbol}: ${nativeTokenMetadata.symbol} price = $${nativeTokenPriceUsd}`);
    
    if (nativeTokenPriceUsd <= 0) {
      console.warn(`⚠️ Invalid ${nativeTokenMetadata.symbol} price for ${token.symbol}: ${nativeTokenPriceUsd}`);
      return 0;
    }
    
    // Handle native token (ETH/MATIC/BNB/etc.) directly
    if (token.address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()) {
      const result = token.balanceNum * nativeTokenPriceUsd;
      console.log(`🔍 DEBUG ${token.symbol}: ${nativeTokenMetadata.symbol} token = ${token.balanceNum} * ${nativeTokenPriceUsd} = $${result}`);
      return result;
    }
    
    // If token is USDC, return balance directly (check by symbol)
    if (token.symbol === 'USDC') {
      console.log(`🔍 DEBUG ${token.symbol}: USDC token = $${token.balanceNum}`);
      return token.balanceNum;
    }
    
    // Try to find USDC address dynamically for direct pricing
    // This avoids the native token confusion (MATIC, S, xDAI vs ETH)
    const usdcAddress = await api.findUsdcAddress(chainId, apiKey, fetch);
    
    if (usdcAddress) {
      const quoteAmount = 0.01 * Math.pow(10, token.decimals);
      console.log(`🔍 DEBUG ${token.symbol}: Requesting quote for ${quoteAmount} wei to USDC`);
      
      const quote = await api.getQuote(
        chainId,
        token.address,
        usdcAddress,
        quoteAmount.toString(),
        apiKey
      );
      
      // Handle null quote response (no liquidity available)
      if (!quote) {
        console.log(`🔍 DEBUG ${token.symbol}: No quote available (no liquidity)`);
        return 0;
      }
      
      console.log(`🔍 DEBUG ${token.symbol}: Full 1inch response:`, JSON.stringify(quote, null, 2));
      console.log(`🔍 DEBUG ${token.symbol}: Quote received - src: ${quote.srcAmount}, dst: ${quote.dstAmount}`);
      
      // Calculate token price in USDC using viem's formatUnits for reliable parsing
      const usdcAmount = parseFloat(formatUnits(BigInt(quote.dstAmount), 6)); // USDC has 6 decimals
      
      // Handle case where srcAmount is undefined - use viem for reliable parsing
      let tokenAmount;
      if (quote.srcAmount && quote.srcAmount !== 'undefined') {
        tokenAmount = parseFloat(formatUnits(BigInt(quote.srcAmount), token.decimals));
      } else {
        // Use viem to format the requested quote amount
        tokenAmount = parseFloat(formatUnits(BigInt(quoteAmount), token.decimals));
        console.log(`🔍 DEBUG ${token.symbol}: Using requested amount ${tokenAmount} (srcAmount was undefined)`);
      }
      
      const tokenPriceUsd = usdcAmount / tokenAmount;
      const finalValue = token.balanceNum * tokenPriceUsd;
      
      console.log(`🔍 DEBUG ${token.symbol}: usdcAmount=${usdcAmount}, tokenAmount=${tokenAmount}, priceUsd=${tokenPriceUsd}`);
      console.log(`🔍 DEBUG ${token.symbol}: Final calc = ${token.balanceNum} * ${tokenPriceUsd} = $${finalValue}`);
      
      if (isNaN(finalValue)) {
        console.warn(`⚠️ Final result is NaN for ${token.symbol}`);
        return 0;
      }
      
      return finalValue;
    }
    
    // Fallback: quote to native token then convert using ETH price (for ETH-based chains)
    const quoteAmount = 0.01 * Math.pow(10, token.decimals);
    console.log(`🔍 DEBUG ${token.symbol}: No USDC address, fallback to native token quote for ${quoteAmount} wei`);
    
    const quote = await api.getQuote(
      chainId,
      token.address,
      NATIVE_TOKEN_ADDRESS, // Native token on each chain
      quoteAmount.toString(),
      apiKey
    );
    
    // Handle null quote response (no liquidity available)
    if (!quote) {
      console.log(`🔍 DEBUG ${token.symbol}: No fallback quote available (no liquidity)`);
      return 0;
    }
    
    console.log(`🔍 DEBUG ${token.symbol}: Full 1inch response:`, JSON.stringify(quote, null, 2));
    console.log(`🔍 DEBUG ${token.symbol}: Quote received - src: ${quote.srcAmount}, dst: ${quote.dstAmount}`);
    
    // Calculate token price in ETH using viem's formatUnits for reliable parsing
    const ethAmount = parseFloat(formatUnits(BigInt(quote.dstAmount), 18)); // ETH has 18 decimals
    
    // Handle case where srcAmount is undefined - use viem for reliable parsing
    let tokenAmount;
    if (quote.srcAmount && quote.srcAmount !== 'undefined') {
      tokenAmount = parseFloat(formatUnits(BigInt(quote.srcAmount), token.decimals));
    } else {
      // Use viem to format the requested quote amount
      tokenAmount = parseFloat(formatUnits(BigInt(quoteAmount), token.decimals));
      console.log(`🔍 DEBUG ${token.symbol}: Using requested amount ${tokenAmount} (srcAmount was undefined)`);
    }
    
    const tokenPriceInEth = ethAmount / tokenAmount;
    
    console.log(`🔍 DEBUG ${token.symbol}: ethAmount=${ethAmount}, tokenAmount=${tokenAmount}, priceInEth=${tokenPriceInEth}`);
    
    // Check for NaN in calculations
    if (isNaN(tokenPriceInEth) || tokenPriceInEth <= 0) {
      console.warn(`⚠️ Invalid token price calculation for ${token.symbol}: ${tokenPriceInEth}`);
      return 0;
    }
    
    // Calculate USD value using native token price
    const tokenPriceUsd = tokenPriceInEth * nativeTokenPriceUsd;
    const finalValue = token.balanceNum * tokenPriceUsd;
    
    console.log(`🔍 DEBUG ${token.symbol}: Final calc = ${token.balanceNum} * ${tokenPriceUsd} = $${finalValue}`);
    
    // Final NaN check
    if (isNaN(finalValue)) {
      console.warn(`⚠️ Final result is NaN for ${token.symbol}`);
      return 0;
    }
    
    return finalValue;
  } catch (error) {
    console.warn(`⚠️ Failed to calculate USD value for ${token.symbol}:`, (error as Error).message);
    return 0;
  }
}

/**
 * Get native token price in USDC for a specific chain (cached per chain)
 */
async function getNativeTokenPriceUsd(chainId: number, apiKey: string, api: ApiImplementation): Promise<number> {
  const now = Date.now();
  
  // Check cache for this specific chain
  const cached = nativeTokenPriceCache[chainId];
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }
  
  try {
    // Get native token metadata dynamically
    const nativeTokenMetadata = await getNativeTokenMetadata(chainId, apiKey, api);
    
    // Find USDC address dynamically on this chain for native token pricing
    console.log(`🔍 DEBUG: Finding USDC address on chain ${chainId} for ${nativeTokenMetadata.symbol} pricing...`);
    const usdcAddress = await api.findUsdcAddress(chainId, apiKey, fetch);
    if (!usdcAddress) {
      throw new Error(`No USDC found on chain ${chainId} for ${nativeTokenMetadata.symbol} pricing`);
    }
    console.log(`✅ DEBUG: Found USDC address on chain ${chainId}: ${usdcAddress}`);
    
    // Get quote for 1 native token to USDC
    console.log(`🔍 DEBUG: Getting ${nativeTokenMetadata.symbol}/USDC quote on chain ${chainId}...`);
    const quote = await api.getQuote(
      chainId,
      NATIVE_TOKEN_ADDRESS, // 0xeeee...eeee represents native token on all chains
      usdcAddress,
      '1000000000000000000', // 1 native token in wei (18 decimals)
      apiKey
    );
    console.log(`🔍 DEBUG: ETH/USDC quote response:`, JSON.stringify(quote, null, 2));
    
    // Handle null quote response (no liquidity available)
    if (!quote) {
      throw new Error(`No ${nativeTokenMetadata.symbol}/USDC quote available on chain ${chainId}`);
    }
    
    if (!quote.dstAmount || quote.dstAmount === '0') {
      throw new Error(`Invalid quote response: dstAmount is ${quote.dstAmount}`);
    }
    
    // Calculate ETH price in USDC using viem's formatUnits for reliable parsing
    const usdcAmount = parseFloat(formatUnits(BigInt(quote.dstAmount), 6)); // USDC has 6 decimals
    console.log(`💰 DEBUG: Calculated ETH price: $${usdcAmount}`);
    
    if (usdcAmount <= 0 || isNaN(usdcAmount)) {
      throw new Error(`Invalid ETH price calculated: ${usdcAmount}`);
    }
    
    // Cache the result for this specific chain
    nativeTokenPriceCache[chainId] = {
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
