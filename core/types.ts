/**
 * Core Types and Interfaces for Portfolio Management
 * Single responsibility: Define all data contracts and interfaces
 */

import * as defaultApi from './api.js';

// ===== API INTERFACES =====

/**
 * API interface for dependency injection
 */
export interface ApiImplementation {
  getWalletBalances: typeof defaultApi.getWalletBalances;
  getTokenMetadata: typeof defaultApi.getTokenMetadata;
  getQuote: typeof defaultApi.getQuote;
  findUsdcAddress: typeof defaultApi.findUsdcAddress;
}

// ===== CONFIGURATION INTERFACES =====

/**
 * Token scan configuration interface
 */
export interface TokenScanConfig {
  oneinchApiKey: string;
  maxTokensToProcess?: number;
  onProgress?: (progress: ScanProgress) => void;
  excludeTokens?: string[];
  defaultMinUsdValue?: number;
}

export interface ScanProgress {
  phase: 'starting' | 'fetching' | 'fetching_balances' | 'balances_received' | 'fetching_metadata' | 'metadata_received' | 'processing' | 'pricing' | 'filtering' | 'complete';
  chainName?: string;
  chainId?: number;
  currentToken?: string;
  tokenIndex?: number;
  totalTokens?: number;
  tokenCount?: number;
  metadataCount?: number;
  message: string;
}

/**
 * Token filtering options
 */
export interface TokenFilterOptions {
  minUSDValue?: number;
  maxTokensToProcess?: number;
  excludeZeroBalances?: boolean;
  excludeTokens?: string[];
}

// ===== WALLET INTERFACES =====

/**
 * Wallet session interface
 */
export interface WalletSession {
  address: string;
  chainId: number;
  client?: any; // Optional for browser
  topic?: string; // Optional for browser
  isDemo?: boolean; // Optional for demo mode
}

// ===== TOKEN INTERFACES =====

/**
 * Token balance interface
 */
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

/**
 * Token categorization result
 */
export interface TokenCategories {
  dustTokens: TokenBalance[];
  mediumTokens: TokenBalance[];
  significantTokens: TokenBalance[];
}

/**
 * Portfolio statistics
 */
export interface PortfolioStats {
  totalUSD: number;
  tokenCount: number;
}

// ===== SCAN RESULT INTERFACES =====

/**
 * Token scan result interface
 */
export interface TokenScanResult {
  allTokens: TokenBalance[];
  dustTokens: TokenBalance[];
  mediumTokens: TokenBalance[];
  significantTokens: TokenBalance[];
  totalUSD: number;
  chainId: number;
  chainName: string;
  tokens?: TokenBalance[]; // For backward compatibility with existing code
}

/**
 * Formatted output item for terminal display
 */
export interface OutputItem {
  type: string;
  content: string;
}

/**
 * Unified scan result with formatted output
 */
export interface UnifiedScanResult {
  result: TokenScanResult;
  output: OutputItem[];
}

/**
 * Multi-chain scan result with formatted output
 */
export interface MultiChainScanResult {
  results: TokenScanResult[];
  output: OutputItem[];
}
