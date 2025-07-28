#!/usr/bin/env node

import { defineCommand, runMain } from 'citty';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { connectWallet, disconnectWallet, isWalletConnected, getCurrentSession } from './wallet.js';
import { getSupportedChains } from './chains.js';

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
        if (isWalletConnected()) {
          const session = getCurrentSession();
          console.log(chalk.green('✅ Wallet connected'));
          console.log(chalk.blue(`📍 Address: ${session?.address}`));
          console.log(chalk.blue(`⛓️ Chain ID: ${session?.chainId}`));
        } else {
          console.log(chalk.yellow('❌ No wallet connected'));
          console.log(chalk.gray('Use `uniter.sh connect` to connect your wallet'));
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
