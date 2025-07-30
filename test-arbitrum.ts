#!/usr/bin/env bun

/**
 * Quick test to debug Arbitrum token processing
 */

import { restoreSession } from './cli/wallet.js';
import { scanTokens } from './cli/tokens.js';

async function testArbitrum() {
  console.log('🔍 Testing Arbitrum token scanning with debug output...\n');
  
  // Restore session
  const restored = await restoreSession();
  if (!restored) {
    console.error('❌ Could not restore session');
    return;
  }
  
  const { getCurrentSession } = await import('./cli/wallet.js');
  const session = getCurrentSession();
  if (!session) {
    console.error('❌ No session available');
    return;
  }
  
  // Create Arbitrum session
  const arbitrumSession = {
    ...session,
    chainId: 42161 // Arbitrum One
  };
  
  console.log(`🔍 Testing wallet ${arbitrumSession.address} on Arbitrum (42161)`);
  
  try {
    await scanTokens(arbitrumSession);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testArbitrum().catch(console.error);
