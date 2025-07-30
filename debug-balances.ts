#!/usr/bin/env bun

/**
 * Debug script to check raw token balances across chains
 * This will help us understand if tokens actually have non-zero balances
 */

import { loadConfig } from './cli/config.js';
import { SUPPORTED_CHAINS } from './cli/chains.js';

const ONEINCH_BASE_URL = 'https://api.1inch.dev';

async function checkRawBalances() {
  const config = loadConfig();
  if (!config.oneinchApiKey) {
    console.error('❌ No 1inch API key configured');
    return;
  }

  // Your wallet address
  const walletAddress = '0x830bc5551e429DDbc4E9Ac78436f8Bf13Eca8434';
  
  console.log('🔍 Checking raw balances across all chains...\n');

  for (const chain of SUPPORTED_CHAINS.slice(0, 3)) { // Test first 3 chains only
    try {
      console.log(`📡 Checking ${chain.name} (${chain.id})...`);
      
      const response = await fetch(
        `${ONEINCH_BASE_URL}/balance/v1.2/${chain.id}/balances/${walletAddress}`,
        {
          headers: {
            'Authorization': `Bearer ${config.oneinchApiKey}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.log(`❌ API Error: ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      const entries = Object.entries(data);
      
      console.log(`📊 Total tokens: ${entries.length}`);
      
      // Check for non-zero balances
      const nonZeroBalances = entries.filter(([_, balance]) => {
        const balanceStr = balance as string;
        return balanceStr !== '0' && !balanceStr.startsWith('0.') && balanceStr !== '0.0';
      });
      
      console.log(`💰 Non-zero balances: ${nonZeroBalances.length}`);
      
      if (nonZeroBalances.length > 0) {
        console.log('🎯 Found non-zero balances:');
        nonZeroBalances.slice(0, 10).forEach(([address, balance]) => {
          console.log(`  ${address}: ${balance}`);
        });
      } else {
        console.log('🔍 All balances are zero on this chain');
        // Show a few sample zero balances
        console.log('📝 Sample zero balances:');
        entries.slice(0, 3).forEach(([address, balance]) => {
          console.log(`  ${address}: ${balance}`);
        });
      }
      
      console.log(''); // Empty line for readability
      
    } catch (error) {
      console.error(`❌ Error checking ${chain.name}:`, error);
    }
  }
}

checkRawBalances().catch(console.error);
