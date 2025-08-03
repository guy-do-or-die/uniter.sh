/**
 * Sweep Command Implementation
 * Swaps all dust tokens to native tokens using 1inch API
 */

import { getLastScanResults, getAllDustTokens, hasRecentScanResults } from './scan-storage.js';
import { getSwap, canSwapToken, getApproveTransaction, getCurrentAllowance } from './api.js';
import { NATIVE_TOKEN_ADDRESS } from './api.js';

import type { WalletSession, ApiImplementation } from './types.js';
import * as defaultApi from './api.js';
import { formatUnits } from 'viem';
import { getChainById } from './chains.js';

export interface SweepProgress {
  phase: 'starting' | 'checking' | 'approving' | 'swapping' | 'complete' | 'failed';
  chainName?: string;
  chainId?: number;
  currentToken?: string;
  tokenIndex?: number;
  totalTokens?: number;
  message: string;
  swapData?: any;
  allowanceData?: any;
}

export interface SweepResult {
  success: boolean;
  totalTokensProcessed: number;
  successfulSwaps: number;
  failedSwaps: number;
  allowanceTransactions: Array<{
    chainId: number;
    chainName: string;
    tokenSymbol: string;
    tokenAddress: string;
    txData: any;
    success: boolean;
    error?: string;
  }>;
  swapTransactions: Array<{
    chainId: number;
    chainName: string;
    tokenSymbol: string;
    tokenAddress: string;
    amount: string;
    txData: any;
    success: boolean;
    error?: string;
  }>;
  totalGasEstimate?: string;
}

/**
 * Execute sweep command to swap all dust tokens to native tokens
 */
export async function executeSweep(
  session: WalletSession,
  onProgress?: (progress: SweepProgress) => void,
  api: ApiImplementation = defaultApi,
): Promise<SweepResult> {
  
  // Environment detection for API key handling
  const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
  const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
  
  // Get API key based on environment - let the API layer handle the details
  const getApiKey = (): string => {
    if (isBrowser) {
      // In browser, API calls go through proxy, so we don't need the actual API key
      return '';
    } else if (isNode) {
      // In Node.js (CLI), use environment variable
      return process.env.ONEINCH_API_KEY || '';
    }
    return '';
  };
  
  const apiKey = getApiKey();
  
  // Check if we have recent scan results
  if (!hasRecentScanResults()) {
    throw new Error('No recent scan results found. Please run "scan" or "multichain" command first.');
  }

  const scanResults = getLastScanResults();
  if (!scanResults) {
    throw new Error('No scan results available. Please run "scan" or "multichain" command first.');
  }

  const dustTokens = getAllDustTokens();
  
  if (dustTokens.length === 0) {
    onProgress?.({
      phase: 'complete',
      message: 'No dust tokens found to sweep.'
    });
    
    return {
      success: true,
      totalTokensProcessed: 0,
      successfulSwaps: 0,
      failedSwaps: 0,
      allowanceTransactions: [],
      swapTransactions: []
    };
  }

  const chainId = scanResults.results[0].chainId;
  const chainName = scanResults.results[0].chainName;
  const chain = getChainById(chainId);
  
  onProgress?.({
    phase: 'starting',
    chainName,
    chainId,
    totalTokens: dustTokens.length,
    message: `Starting sweep of ${dustTokens.length} dust tokens on ${chainName}...`
  });

  const result: SweepResult = {
    success: false,
    totalTokensProcessed: 0,
    successfulSwaps: 0,
    failedSwaps: 0,
    allowanceTransactions: [],
    swapTransactions: []
  };

  // Process each token sequentially: check allowance → execute allowance if needed → execute swap
  for (let i = 0; i < dustTokens.length; i++) {
    const tokenData = dustTokens[i];
    const token = tokenData.token;
    
    console.log(`\n🔄 Processing token ${i + 1}/${dustTokens.length}: ${token.symbol}`);
    
    onProgress?.({
      phase: 'checking',
      chainName,
      chainId,
      currentToken: token.symbol,
      tokenIndex: i + 1,
      totalTokens: dustTokens.length,
      message: `Processing ${token.symbol} (${i + 1}/${dustTokens.length})...`
    });

    try {
      // STEP 1: Check current allowance
      console.log(`🔍 Step 1: Checking allowance for ${token.symbol}...`);
      const currentAllowance = await api.getCurrentAllowance(
        chainId,
        token.address,
        session.address,
        apiKey
      );

      console.log(`🔍 Allowance check result for ${token.symbol}:`, {
        currentAllowance,
        tokenBalance: token.balance,
        needsApproval: !currentAllowance || BigInt(currentAllowance) < BigInt(token.balance)
      });

      // STEP 2: Execute allowance transaction if needed
      const needsApproval = !currentAllowance || BigInt(currentAllowance) < BigInt(token.balance);
      
      if (needsApproval) {
        console.log(`🔐 Step 2: Executing allowance transaction for ${token.symbol}...`);
        
        onProgress?.({
          phase: 'approving',
          chainName,
          chainId,
          currentToken: token.symbol,
          tokenIndex: i + 1,
          totalTokens: dustTokens.length,
          message: `Executing allowance for ${token.symbol}...`
        });

        const allowanceTx = await api.getApproveTransaction(
          chainId,
          token.address,
          token.balance,
          apiKey
        );

        if (allowanceTx) {
          try {
            if (session.sendTransaction) {
              console.log(`🔐 Sending allowance transaction for ${token.symbol}`);
              
              const txHash = await session.sendTransaction({
                to: allowanceTx.to,
                data: allowanceTx.data,
                value: allowanceTx.value || '0x0',
                gas: allowanceTx.gas,
                gasPrice: allowanceTx.gasPrice,
                chainId: chainId
              });

              console.log(`✅ Allowance transaction confirmed for ${token.symbol}: ${txHash}`);
              
              // Brief delay to ensure 1inch API recognizes the updated allowance
              console.log(`⏳ Waiting for allowance to propagate...`);
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              result.allowanceTransactions.push({
                chainId,
                chainName,
                tokenSymbol: token.symbol,
                tokenAddress: token.address,
                txData: { ...allowanceTx, hash: txHash },
                success: true
              });
            } else {
              throw new Error('No transaction execution capability available');
            }
          } catch (error) {
              console.error(`❌ Allowance transaction failed for ${token.symbol}:`, error);
            result.allowanceTransactions.push({
              chainId,
              chainName,
              tokenSymbol: token.symbol,
              tokenAddress: token.address,
              txData: allowanceTx,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            // Skip swap if allowance failed
            continue;
          }
        } else {
          console.log(`⚠️ No allowance transaction data for ${token.symbol}`);
          // Skip swap if we can't get allowance data
          continue;
        }
      } else {
        console.log(`✅ Sufficient allowance for ${token.symbol}`);
      }

      // STEP 3: Execute swap transaction
      console.log(`🔄 Step 3: Executing swap for ${token.symbol}...`);
      
      onProgress?.({
        phase: 'swapping',
        chainName,
        chainId,
        currentToken: token.symbol,
        tokenIndex: i + 1,
        totalTokens: dustTokens.length,
        message: `Swapping ${token.symbol}...`
      });

      const swapData = await api.getSwap(
        chainId,
        token.address,
        NATIVE_TOKEN_ADDRESS,
        token.balance,
        session.address,
        1, // 1% slippage
        apiKey
      );

      if (!swapData) {
        console.log(`❌ No swap data returned for ${token.symbol}`);
        result.swapTransactions.push({
          chainId,
          chainName,
          tokenSymbol: token.symbol,
          tokenAddress: token.address,
          amount: token.balance,
          txData: null,
          success: false,
          error: 'No swap data returned from API'
        });
        continue;
      }

      try {
        if (session.sendTransaction && swapData.tx) {
          const txHash = await session.sendTransaction({
            to: swapData.tx.to,
            data: swapData.tx.data,
            value: swapData.tx.value || '0x0',
            gas: swapData.tx.gas,
            gasPrice: swapData.tx.gasPrice,
            chainId: chainId
          });

          console.log(`✅ Swap executed for ${token.symbol}: ${txHash}`);

          result.swapTransactions.push({
            chainId,
            chainName,
            tokenSymbol: token.symbol,
            tokenAddress: token.address,
            amount: token.balance,
            txData: { ...swapData.tx, hash: txHash },
            success: true
          });
        } else {
          throw new Error('No transaction execution capability available');
        }
      } catch (error) {
          console.error(`❌ Swap failed for ${token.symbol}:`, error);
        result.swapTransactions.push({
          chainId,
          chainName,
          tokenSymbol: token.symbol,
          tokenAddress: token.address,
          amount: token.balance,
          txData: swapData.tx,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      console.log(`✅ Completed processing ${token.symbol}`);
      
    } catch (error) {
      console.error(`❌ Failed to process ${token.symbol}:`, error);
      result.swapTransactions.push({
        chainId,
        chainName,
        tokenSymbol: token.symbol,
        tokenAddress: token.address,
        amount: token.balance,
        txData: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Calculate final results
  result.totalTokensProcessed = dustTokens.length;
  result.successfulSwaps = result.swapTransactions.filter(tx => tx.success).length;
  result.failedSwaps = result.swapTransactions.filter(tx => !tx.success).length;
  result.success = result.successfulSwaps > 0;

  onProgress?.({
    phase: 'complete',
    chainName,
    chainId,
    totalTokens: dustTokens.length,
    message: `Sweep complete! Executed ${result.allowanceTransactions.length} allowances and ${result.successfulSwaps} swaps.`
  });

  return result;
}

/**
 * Format sweep results for display
 */
export function formatSweepResults(result: SweepResult): string[] {
  const output: string[] = [];
  
  output.push('');
  output.push(`🧹 Sweep Results:`);
  output.push('─'.repeat(50));
  output.push(`Total Tokens Processed: ${result.totalTokensProcessed}`);
  output.push(`Allowance Transactions: ${result.allowanceTransactions.length}`);
  output.push(`Successful Swaps: ${result.successfulSwaps}`);
  output.push(`Failed Swaps: ${result.failedSwaps}`);
  
  output.push('');
  
  // Combine all transactions for display
  const allTransactions = [...result.allowanceTransactions, ...result.swapTransactions];
  
  // Group transactions by chain
  const chainGroups = allTransactions.reduce((groups: Record<number, typeof allTransactions>, tx) => {
    if (!groups[tx.chainId]) {
      groups[tx.chainId] = [];
    }
    groups[tx.chainId].push(tx);
    return groups;
  }, {});
  
  Object.entries(chainGroups).forEach(([chainId, transactions]) => {
    const chainName = transactions[0].chainName;
    const successful = transactions.filter((tx: any) => tx.success).length;
    const failed = transactions.filter((tx: any) => !tx.success).length;
    
    output.push(`🔗 ${chainName} (${successful}/${transactions.length} successful):`);
    
    transactions.forEach((tx: any) => {
      const status = tx.success ? '✅' : '❌';
      const type = result.allowanceTransactions.includes(tx) ? '[APPROVE]' : '[SWAP]';
      const error = tx.error ? ` (${tx.error})` : '';
      output.push(`  ${status} ${type} ${tx.tokenSymbol} - skipped`);
    });
    
    output.push('');
  });
  
  return output;
}
