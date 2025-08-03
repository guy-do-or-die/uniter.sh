/**
 * In-memory storage for scan results
 * Stores the last scan results for use by sweep command
 * Works in both CLI and web environments
 */

import type { TokenScanResult, WalletSession } from './types.js';
import { NATIVE_TOKEN_ADDRESS } from './api.js';

interface StoredScanData {
  results: TokenScanResult[];
  session: WalletSession;
  timestamp: number;
  scanType: 'single' | 'multichain';
}

// Global in-memory storage
let lastScanData: StoredScanData | null = null;

/**
 * Store scan results in memory
 */
export function storeScanResults(
  results: TokenScanResult | TokenScanResult[],
  session: WalletSession,
  scanType: 'single' | 'multichain' = 'single'
): void {
  const resultsArray = Array.isArray(results) ? results : [results];
  
  lastScanData = {
    results: resultsArray,
    session,
    timestamp: Date.now(),
    scanType
  };
  
  console.log(`📦 Stored scan results: ${resultsArray.length} chain(s), ${getTotalDustTokens(resultsArray)} dust tokens`);
}

/**
 * Get the last stored scan results
 */
export function getLastScanResults(): StoredScanData | null {
  return lastScanData;
}

/**
 * Clear stored scan results
 */
export function clearScanResults(): void {
  lastScanData = null;
  console.log('🗑️ Cleared stored scan results');
}

/**
 * Check if scan results are available and recent (within 1 hour)
 */
export function hasRecentScanResults(): boolean {
  if (!lastScanData) return false;
  
  const oneHour = 60 * 60 * 1000;
  const isRecent = Date.now() - lastScanData.timestamp < oneHour;
  
  return isRecent;
}

/**
 * Get all dust tokens from stored scan results
 */
export function getAllDustTokens(): Array<{ token: any; chainId: number; chainName: string }> {
  if (!lastScanData) return [];
  
  const dustTokens: Array<{ token: any; chainId: number; chainName: string }> = [];
  
  lastScanData.results.forEach(result => {
    result.dustTokens.forEach(token => {
      // Filter out native tokens (ETH) since they can't be swapped to themselves
      if (token.address.toLowerCase() !== NATIVE_TOKEN_ADDRESS.toLowerCase()) {
        dustTokens.push({
          token,
          chainId: result.chainId,
          chainName: result.chainName
        });
      }
    });
  });
  
  return dustTokens;
}

/**
 * Get total count of dust tokens across all chains
 */
export function getTotalDustTokens(results?: TokenScanResult[]): number {
  const resultsToUse = results || lastScanData?.results || [];
  return resultsToUse.reduce((total, result) => total + result.dustTokens.length, 0);
}

/**
 * Get summary of stored scan results
 */
export function getScanResultsSummary(): {
  totalChains: number;
  totalTokens: number;
  totalDustTokens: number;
  totalValue: number;
  scanAge: string;
} | null {
  if (!lastScanData) return null;

  const totalChains = lastScanData.results.length;
  const totalTokens = lastScanData.results.reduce((sum, r) => sum + r.allTokens.length, 0);
  const totalDustTokens = getTotalDustTokens();
  const totalValue = lastScanData.results.reduce((sum, r) => sum + r.totalUSD, 0);
  
  const ageMs = Date.now() - lastScanData.timestamp;
  const ageMinutes = Math.floor(ageMs / (1000 * 60));
  const scanAge = ageMinutes < 1 ? 'just now' : `${ageMinutes} minutes ago`;

  return {
    totalChains,
    totalTokens,
    totalDustTokens,
    totalValue,
    scanAge
  };
}
