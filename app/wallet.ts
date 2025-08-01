/**
 * Web wallet management using Wagmi
 * Browser-compatible wallet operations
 */

import { connect, disconnect, getAccount, getChainId } from '@wagmi/core';
import { createConfig, http } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { SUPPORTED_CHAINS, getChainName } from '../shared/chains.js';
import { loadBrowserConfig } from './config.js';

// Web wallet session interface
export interface WebWalletSession {
  address: string;
  chainId: number;
  chainName: string;
}

// Initialize Wagmi config
const browserConfig = loadBrowserConfig();

export const config = createConfig({
  chains: SUPPORTED_CHAINS as any,
  connectors: [
    injected(),
    walletConnect({ 
      projectId: browserConfig.walletConnectProjectId || 'default-project-id',
      metadata: {
        name: 'Uniter DeFi Terminal',
        description: 'Multi-chain DeFi portfolio scanner',
        url: 'https://uniter.sh',
        icons: ['https://uniter.sh/icon.png']
      }
    })
  ],
  transports: Object.fromEntries(
    SUPPORTED_CHAINS.map(chain => [chain.id, http()])
  ),
});

let currentSession: WebWalletSession | null = null;

/**
 * Connect wallet using injected provider (MetaMask, etc.)
 */
export async function connectWallet(): Promise<WebWalletSession> {
  try {
    const result = await connect(config, { connector: injected() });
    const account = getAccount(config);
    const chainId = getChainId(config);
    
    currentSession = {
      address: account.address || '',
      chainId: chainId,
      chainName: getChainName(chainId)
    };
    
    return currentSession;
  } catch (error) {
    console.error('Wallet connection failed:', error);
    throw new Error('Failed to connect wallet. Please make sure you have a Web3 wallet installed.');
  }
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet(): Promise<void> {
  try {
    await disconnect(config);
    currentSession = null;
  } catch (error) {
    console.error('Wallet disconnection failed:', error);
    throw new Error('Failed to disconnect wallet.');
  }
}

/**
 * Check if wallet is currently connected
 */
export function isWalletConnected(): boolean {
  const account = getAccount(config);
  return account.isConnected && !!account.address;
}

/**
 * Get current wallet session
 */
export function getCurrentSession(): WebWalletSession | null {
  if (isWalletConnected()) {
    const account = getAccount(config);
    const chainId = getChainId(config);
    
    return {
      address: account.address || '',
      chainId: chainId,
      chainName: getChainName(chainId)
    };
  }
  return currentSession;
}

/**
 * Restore session (check if wallet is already connected)
 */
export async function restoreSession(): Promise<WebWalletSession | null> {
  // Check if wallet is already connected
  if (isWalletConnected()) {
    const account = getAccount(config);
    const chainId = getChainId(config);
    
    currentSession = {
      address: account.address || '',
      chainId: chainId,
      chainName: getChainName(chainId)
    };
    
    return currentSession;
  }
  return null;
}
