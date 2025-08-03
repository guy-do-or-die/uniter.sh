/**
 * Token Processing and Pricing Logic
 * Single responsibility: Process token balances, calculate USD values, filter and categorize tokens
 */

import { formatUnits, parseUnits, zeroAddress } from 'viem';
import { formatUsdValue } from './terminal/display.js';
import { OneInchBalanceResponse, OneInchTokenMetadata, NATIVE_TOKEN_ADDRESS } from './api.js';
import type { 
  TokenBalance, 
  TokenFilterOptions, 
  TokenCategories, 
  PortfolioStats,
  ApiImplementation 
} from './types.js';

// ===== CACHING =====

// Per-chain native token price cache
const nativeTokenPriceCache: Record<number, { price: number; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache for native token metadata per chain
const nativeTokenMetadataCache: Record<number, { symbol: string; name: string; timestamp: number }> = {};

// ===== NATIVE TOKEN METADATA =====

/**
 * Get native token metadata dynamically using 1inch API
 */
async function getNativeTokenMetadata(
  chainId: number, 
  apiKey: string, 
  api: ApiImplementation
): Promise<{ symbol: string; name: string }> {
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
      throw new Error(`Native token metadata not found for chain ${chainId}`);
    }
    
    // Cache the result
    nativeTokenMetadataCache[chainId] = {
      symbol: nativeToken.symbol,
      name: nativeToken.name,
      timestamp: now
    };
    
    return { symbol: nativeToken.symbol, name: nativeToken.name };
  } catch (error) {
    console.error(`Failed to get native token metadata for chain ${chainId}:`, error);
    // Fallback to generic names
    return { symbol: 'ETH', name: 'Ethereum' };
  }
}

// ===== TOKEN PRICING =====

/**
 * Calculate USD value for a token using 1inch quote API
 */
async function calculateTokenUsdValue(
  tokenAddress: string,
  tokenBalance: string,
  tokenDecimals: number,
  usdcAddress: string,
  chainId: number,
  apiKey: string,
  api: ApiImplementation
): Promise<number> {
  try {
    // Use a small amount for quoting to avoid slippage issues (0.01 tokens in wei)
    const quoteAmountWei = BigInt(tokenBalance); // parseUnits(tokenBalance, tokenDecimals); // Use viem's parseUnits for proper wei conversion
    const quoteAmount = quoteAmountWei.toString(); // 1inch API expects wei amount as string

    console.log({chainId, tokenAddress, usdcAddress, quoteAmount, apiKey}); 
    // Get quote from token to USDC
    const quote = await api.getQuote(chainId, tokenAddress, usdcAddress, quoteAmount, apiKey);

    if (!quote || !quote.dstAmount || BigInt(quote.dstAmount) > 10e18) {
      console.warn(`No quote received for token ${tokenAddress} on chain ${chainId}`);
      return 0;
    }

    // Calculate USD value per token
    const quoteAmountNum = parseFloat(formatUnits(quoteAmountWei, tokenDecimals)); // Convert wei back to decimal for calculation
    const usdValuePerToken = parseFloat(formatUnits(BigInt(quote.dstAmount), 6)) / quoteAmountNum; // USDC has 6 decimals
    
    // Calculate total USD value
    const tokenBalanceNum = parseFloat(formatUnits(BigInt(tokenBalance), tokenDecimals));
    const totalUsdValue = tokenBalanceNum * usdValuePerToken;
    
    // Debug logging for high-value tokens
    if (totalUsdValue > 1000) {
      console.log(`🔍 DEBUG: High-value token calculation:`);
      console.log(`  Token: ${tokenAddress}`);
      console.log(`  Balance: ${tokenBalance} (${tokenBalanceNum} tokens)`);
      console.log(`  Decimals: ${tokenDecimals}`);
      console.log(`  Quote amount: ${quoteAmount} wei (${quoteAmountNum} tokens)`);
      console.log(`  USDC address: ${usdcAddress}`);
      console.log(`  Quote result: ${quote.dstAmount} USDC wei`);
      console.log(`  USD per token: $${usdValuePerToken}`);
      console.log(`  Total USD value: $${totalUsdValue}`);
    }
    
    return totalUsdValue;
  } catch (error) {
    console.error(`Error calculating USD value for token ${tokenAddress}:`, error);
    return 0;
  }
}

// ===== CORE PROCESSING FUNCTIONS =====

/**
 * Process token balances and calculate USD values
 */
export async function processTokenBalances(
  balanceData: OneInchBalanceResponse,
  tokenMetadata: OneInchTokenMetadata,
  chainId: number,
  apiKey: string,
  api: ApiImplementation,
  onProgress?: (progress: any) => void
): Promise<TokenBalance[]> {
  const tokens: TokenBalance[] = [];
  const tokenEntries = Object.entries(balanceData);
  const totalTokens = tokenEntries.length;
  
  // Get USDC address for this chain
  const usdcAddress = await api.findUsdcAddress(chainId, apiKey);

  if (!usdcAddress || usdcAddress === '0') {
    console.warn(`No USDC address found for chain ${chainId}`);
    return [];
  }
 
  for (let i = 0; i < tokenEntries.length; i++) {
    const [address, balance] = tokenEntries[i];
    const metadata = tokenMetadata[address.toLowerCase()];
    if (!metadata) continue;
    
    // Report progress for current token
    onProgress?.({
      phase: 'pricing',
      currentToken: metadata.symbol,
      tokenIndex: i + 1,
      totalTokens,
      message: `Pricing ${metadata.symbol} (${i + 1}/${totalTokens})`
    });
    
    try {
      // Use viem for reliable token value parsing
      const balanceNum = parseFloat(formatUnits(BigInt(balance), metadata.decimals));
      const balanceFormatted = formatUnits(BigInt(balance), metadata.decimals);
     
      // Calculate USD value
      const balanceUSD = address === usdcAddress ? balanceNum : await calculateTokenUsdValue(
        address,
        balance,
        metadata.decimals,
        usdcAddress,
        chainId,
        apiKey,
        api
      );

      tokens.push({
        address,
        symbol: metadata.symbol,
        name: metadata.name,
        decimals: metadata.decimals,
        balance,
        balanceFormatted,
        balanceNum,
        balanceUSD,
        native: address === NATIVE_TOKEN_ADDRESS
      });
      
      // Report completion for current token with detailed info
      const pricePerToken = balanceNum > 0 ? balanceUSD / balanceNum : 0;
      onProgress?.({
        phase: 'pricing',
        currentToken: metadata.symbol,
        tokenIndex: i + 1,
        totalTokens,
        message: `${metadata.symbol}: ${balanceFormatted} × ${formatUsdValue(pricePerToken)} = ${formatUsdValue(balanceUSD)} (${i + 1}/${totalTokens})`
      });
      
    } catch (error) {
      console.warn(`Failed to process token ${metadata.symbol}:`, error);
      
      // Report error for current token
      onProgress?.({
        phase: 'pricing',
        currentToken: metadata.symbol,
        tokenIndex: i + 1,
        totalTokens,
        message: `${metadata.symbol}: Failed to price (${i + 1}/${totalTokens})`
      });
    }
  }
  
  return tokens;
}

/**
 * Filter tokens based on criteria
 */
export function filterTokens(tokens: TokenBalance[], options: TokenFilterOptions = {}): TokenBalance[] {
  let filtered = [...tokens];
  
  // Filter by minimum USD value
  if (options.minUSDValue !== undefined) {
    filtered = filtered.filter(token => token.balanceUSD >= options.minUSDValue!);
  }
  
  // Filter out zero balances
  if (options.excludeZeroBalances) {
    filtered = filtered.filter(token => token.balanceNum > 0);
  }
  
  // Filter out excluded tokens
  if (options.excludeTokens && options.excludeTokens.length > 0) {
    filtered = filtered.filter(token => 
      !options.excludeTokens!.some(excluded => 
        token.address.toLowerCase() === excluded.toLowerCase() ||
        token.symbol.toLowerCase() === excluded.toLowerCase()
      )
    );
  }
  
  // Sort by USD value (highest first)
  filtered.sort((a, b) => b.balanceUSD - a.balanceUSD);
  
  // Limit number of tokens
  if (options.maxTokensToProcess) {
    filtered = filtered.slice(0, options.maxTokensToProcess);
  }
  
  return filtered;
}

/**
 * Categorize tokens by USD value
 */
export function categorizeTokens(
  tokens: TokenBalance[],
  dustThreshold: number = 5,
  significantThreshold: number = 100
): TokenCategories {
  const nativeTokens = tokens.filter(token => token.native);

  const dustTokens = tokens.filter(token => !token.native && token.balanceUSD < dustThreshold);

  const mediumTokens = tokens.filter(token => 
    !token.native && token.balanceUSD >= dustThreshold && token.balanceUSD < significantThreshold
  );

  const significantTokens = tokens.filter(token => !token.native && token.balanceUSD >= significantThreshold);
  
  return { nativeTokens, dustTokens, mediumTokens, significantTokens };
}

/**
 * Calculate portfolio statistics
 */
export function calculatePortfolioStats(tokens: TokenBalance[]): PortfolioStats {
  const totalUSD = tokens.reduce((sum, token) => sum + token.balanceUSD, 0);
  const tokenCount = tokens.length;
  
  return { totalUSD, tokenCount };
}
