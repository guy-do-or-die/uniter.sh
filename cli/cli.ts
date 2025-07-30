#!/usr/bin/env node

import { defineCommand, runMain } from 'citty';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { connectWallet, disconnectWallet, isWalletConnected, getCurrentSession, restoreSession } from './wallet.js';
import { getSupportedChains, SUPPORTED_CHAINS } from './chains.js';
import { scanTokens, displayTokens, scanTokensMultiChain } from './tokens.js';
import { loadConfig } from './config.js';
import { getSwapQuotes, displayQuotes } from './quote.js';

/**
 * Get chain ID from input (can be chain ID or name)
 */
function getChainId(chainInput: string): number {
  // Try parsing as chain ID first
  const chainId = parseInt(chainInput);
  if (!isNaN(chainId)) {
    // Validate that this chain ID is supported
    const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
    if (chain) {
      return chainId;
    }
  }
  
  // Fallback to name matching for common names
  const normalizedInput = chainInput.toLowerCase();
  const chain = SUPPORTED_CHAINS.find(c => {
    const chainName = c.name.toLowerCase();
    return (
      chainName === normalizedInput ||
      (normalizedInput === 'arbitrum' && chainName.includes('arbitrum')) ||
      (normalizedInput === 'base' && chainName === 'base') ||
      (normalizedInput === 'ethereum' && chainName === 'ethereum') ||
      (normalizedInput === 'mainnet' && chainName === 'ethereum')
    );
  });
  
  if (!chain) {
    const supportedIds = SUPPORTED_CHAINS.map(c => `${c.id} (${c.name})`).join(', ');
    throw new Error(`Unsupported chain: ${chainInput}. Supported: ${supportedIds}`);
  }
  return chain.id;
}

// Load environment variables
dotenv.config();

const main = defineCommand({
  meta: {
    name: 'uniter.sh',
    version: '1.0.0',
    description: '🔀 Unite all your onchain dust and scattered assets into a single token',
  },
  subCommands: {
    connect: defineCommand({
      meta: {
        description: '🔗 Connect your wallet via WalletConnect QR code',
      },
      async run() {
        console.log(chalk.cyan('🔗 Connecting wallet...'));
        try {
          const { address, chainId } = await connectWallet();
          console.log(chalk.green(`✅ Connected successfully!`));
          console.log(chalk.blue(`📍 Address: ${address}`));
          console.log(chalk.blue(`⛓️ Chain ID: ${chainId}`));
        } catch (error) {
          console.error(chalk.red('❌ Connection failed:'), error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      },
    }),
    
    disconnect: defineCommand({
      meta: {
        description: '🔌 Disconnect current wallet session',
      },
      async run() {
        if (!isWalletConnected()) {
          console.log(chalk.yellow('ℹ️ No wallet currently connected'));
          return;
        }
        
        try {
          await disconnectWallet();
          console.log(chalk.green('✅ Wallet disconnected successfully'));
        } catch (error) {
          console.error(chalk.red('❌ Disconnect failed:'), error instanceof Error ? error.message : String(error));
        }
      },
    }),
    
    status: defineCommand({
      meta: {
        description: '📊 Show current connection status',
      },
      async run() {
        // Try to restore session first
        const restored = await restoreSession();
        
        if (restored || isWalletConnected()) {
          const session = getCurrentSession();
          console.log(chalk.green('✅ Wallet connected'));
          console.log(chalk.blue(`📍 Address: ${session?.address}`));
          console.log(chalk.blue(`⛓️ Chain ID: ${session?.chainId}`));
          
          if (restored) {
            console.log(chalk.gray('🔄 Session restored from disk'));
          }
        } else {
          console.log(chalk.yellow('❌ No wallet connected'));
          console.log(chalk.gray('Use `uniter.sh connect` to connect your wallet'));
        }
      },
    }),
    
    scan: defineCommand({
      meta: {
        description: '🔍 Scan wallet for token balances using 1inch API',
      },
      args: {
        'dust-threshold': {
          type: 'string',
          description: 'Maximum USD value for dust tokens (default: $5)',
          default: '5',
        },
        'chain': {
          type: 'string',
          description: 'Chain to scan (ID or name, e.g., 42161, arbitrum, base)',
        },
      },
      async run({ args }) {
        // Try to restore session first
        const restored = await restoreSession();
        
        if (!restored && !isWalletConnected()) {
          console.log(chalk.yellow('⚠️ No wallet connected. Please connect your wallet first.'));
          console.log(chalk.gray('Use `uniter.sh connect` to connect your wallet'));
          return;
        }
        
        try {
          console.log(chalk.cyan('🔍 Starting token scan...'));
          const session = getCurrentSession();
          if (!session) {
            console.error('❌ No wallet connected. Please connect your wallet first.');
            return;
          }
          const dustThreshold = parseFloat(String(args['dust-threshold'] || '5'));
          const chainInput = args['chain'] as string | undefined;
          
          let scanResult;
          if (chainInput) {
            // Scan specific chain - create a temporary session for that chain
            const chainSession = {
              ...session,
              chainId: getChainId(chainInput)
            };
            scanResult = await scanTokens(chainSession, dustThreshold);
          } else {
            // Scan current session chain
            scanResult = await scanTokens(session, dustThreshold);
          }
          
          displayTokens(scanResult);
          
          if (scanResult.dustTokens.length > 0) {
            console.log(chalk.yellow(`\n💡 Found ${scanResult.dustTokens.length} dust tokens worth $${scanResult.dustTokens.reduce((sum: number, t: any) => sum + t.balanceUSD, 0).toFixed(2)}`));
            console.log(chalk.gray('Use `uniter.sh sweep` to unite them into a single token'));
          }
        } catch (error) {
          console.error(chalk.red('❌ Token scan failed:'), error instanceof Error ? error.message : String(error));
        }
      },
    }),
    
    multichain: defineCommand({
      meta: {
        description: '🌐 Scan wallet tokens across all supported chains',
      },
      async run() {
        // Try to restore session first
        const restored = await restoreSession();
        
        if (!restored && !isWalletConnected()) {
          console.log(chalk.yellow('⚠️ No wallet connected. Please connect your wallet first.'));
          console.log(chalk.gray('Use `uniter.sh connect` to connect your wallet'));
          return;
        }
        
        try {
          console.log(chalk.cyan('🌐 Starting multi-chain token scan...'));
          const session = getCurrentSession();
          if (!session) {
            console.error('❌ No wallet connected. Please connect your wallet first.');
            return;
          }
          
          const { scanTokensMultiChain } = await import('./tokens.js');
          await scanTokensMultiChain(session);
          
        } catch (error) {
          console.error(chalk.red('❌ Multi-chain scan failed:'), error instanceof Error ? error.message : String(error));
        }
      },
    }),
    
    quote: defineCommand({
      meta: {
        description: '💱 Get swap quotes for dust tokens',
      },
      args: {
        'dust-only': {
          type: 'boolean',
          description: 'Only quote dust tokens (always quotes to ETH)',
          alias: 'd',
        },
      },
      async run({ args }) {
        // Try to restore session first
        const restored = await restoreSession();
        
        if (!restored && !isWalletConnected()) {
          console.log(chalk.yellow('⚠️ No wallet connected. Please connect your wallet first.'));
          console.log(chalk.gray('Use `uniter.sh connect` to connect your wallet'));
          return;
        }
        
        try {
          console.log(chalk.cyan('🔍 Scanning tokens first...'));
          const session = getCurrentSession();
          if (!session) {
            console.error('❌ No wallet connected. Please connect your wallet first.');
            return;
          }
          const scanResult = await scanTokens(session); // Use default $5 dust threshold and ETH target
          
          // Determine which tokens to quote
          const tokensToQuote = args['dust-only'] 
            ? scanResult.dustTokens 
            : [...scanResult.dustTokens, ...scanResult.mediumTokens];
          
          if (tokensToQuote.length === 0) {
            console.log(chalk.yellow('ℹ️ No tokens found to quote'));
            return;
          }
          
          console.log(chalk.cyan(`💱 Getting quotes for ${tokensToQuote.length} tokens...`));
          const { getSwapQuotes, displayQuotes } = await import('./quote.js');
          const quoteResult = await getSwapQuotes(tokensToQuote);
          displayQuotes(quoteResult);
          
          if (quoteResult.quotes.length > 0) {
            console.log(chalk.green(`\n💡 Ready to sweep? Use \`uniter.sh sweep\` to execute these swaps`));
          }
        } catch (error) {
          console.error(chalk.red('❌ Quote failed:'), error instanceof Error ? error.message : String(error));
        }
      },
    }),
    
    chains: defineCommand({
      meta: {
        description: '⛓️ List supported chains',
      },
      async run() {
        console.log(chalk.cyan('🔗 Supported testnet chains:'));
        // Import SUPPORTED_CHAINS to get actual chain data
        const { SUPPORTED_CHAINS } = await import('./chains.js');
        SUPPORTED_CHAINS.forEach((chain, index) => {
          console.log(chalk.blue(`  ${index + 1}. ${chain.name} (ID: ${chain.id})`));
        });
      },
    }),
  },
  args: {
    help: {
      type: 'boolean',
      description: 'Show help',
      alias: 'h',
    },
  },
  async run({ args }) {
    if (args.help) {
      console.log(chalk.cyan('🔀 uniter.sh - Unite your scattered tokens'));
      console.log(chalk.gray('\nAvailable commands:'));
      console.log(chalk.gray('  connect    - Connect wallet via QR code'));
      console.log(chalk.gray('  disconnect - Disconnect current wallet'));
      console.log(chalk.gray('  status     - Show connection status'));
      console.log(chalk.gray('  chains     - List supported chains'));
      return;
    }
    
    console.log(chalk.cyan('🔀 Welcome to uniter.sh!'));
    console.log(chalk.gray('Use `uniter.sh --help` to see available commands'));
    console.log(chalk.gray('Start with `uniter.sh connect` to connect your wallet'));
  },
});

runMain(main);
