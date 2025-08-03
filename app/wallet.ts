/**
 * Web wallet management using Wagmi
 * Browser-compatible wallet operations
 */

import { connect, disconnect, getAccount, getChainId, reconnect, switchChain } from '@wagmi/core';
import { createConfig, http } from 'wagmi';
import { createStorage } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { sendTransaction, waitForTransactionReceipt } from '@wagmi/core';
import { SUPPORTED_CHAINS, getChainName } from '../core/chains.js';
import { loadBrowserConfig } from './config.js';

// Web wallet session interface
export interface WebWalletSession {
  address: string;
  chainId: number;
  chainName: string;
  sendTransaction?: (txData: {
    to: string;
    data: string;
    value?: string;
    gas?: string;
    gasPrice?: string;
    chainId?: number;
  }) => Promise<string>;
}

/**
 * Create sendTransaction function for wallet sessions
 * Centralized implementation to avoid code duplication
 */
function createSendTransaction() {
  return async (txData: {
    to: string;
    data: string;
    value?: string;
    gas?: string;
    gasPrice?: string;
    chainId?: number;
  }) => {
    // Switch to target chain if specified and different from current
    if (txData.chainId) {
      const currentChainId = getChainId(config);
      if (currentChainId !== txData.chainId) {
        console.log(`🔄 Switching from chain ${currentChainId} to chain ${txData.chainId}`);
        try {
          await switchChain(config, { chainId: txData.chainId });
          console.log(`✅ Successfully switched to chain ${txData.chainId}`);
        } catch (error) {
          console.error(`❌ Failed to switch to chain ${txData.chainId}:`, error);
          throw new Error(`Failed to switch to chain ${txData.chainId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    
    // Use Wagmi's sendTransaction for proper wallet integration
    const hash = await sendTransaction(config, {
      to: txData.to as `0x${string}`,
      data: txData.data as `0x${string}`,
      value: txData.value ? BigInt(txData.value) : undefined,
      gas: txData.gas ? BigInt(txData.gas) : undefined,
      gasPrice: txData.gasPrice ? BigInt(txData.gasPrice) : undefined
    });
    
    // Wait for transaction receipt to ensure it's mined
    await waitForTransactionReceipt(config, {
      hash: hash
    });
    
    return hash;
  };
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
  storage: createStorage({
    storage: localStorage,
    key: 'uniter-wagmi',
  }),
});

// Remove manual session tracking - rely entirely on Wagmi's state

// Initialize Wagmi and attempt reconnection
let wagmiInitialized = false;

async function initializeWagmi(): Promise<void> {
  if (wagmiInitialized) return;
  
  try {
    // Attempt to reconnect to previously connected wallets
    await reconnect(config);
    wagmiInitialized = true;
    console.log('✅ Wagmi initialized and reconnection attempted');
  } catch (error) {
    console.log('ℹ️ Wagmi reconnection failed (this is normal if no previous connection):', error);
    wagmiInitialized = true;
  }
}

/**
 * Connect to wallet
 */
export async function connectWallet(): Promise<WebWalletSession> {
  try {
    // Try injected wallet first (MetaMask, etc.)
    let result;
    try {
      result = await connect(config, { connector: injected() });
    } catch (injectedError) {
      console.log('Injected wallet not available, trying WalletConnect...');
      // If injected fails, try WalletConnect
      const browserConfig = loadBrowserConfig();
      result = await connect(config, { 
        connector: walletConnect({ 
          projectId: browserConfig.walletConnectProjectId || 'default-project-id',
          metadata: {
            name: 'Uniter DeFi Terminal',
            description: 'Multi-chain DeFi portfolio scanner',
            url: 'https://uniter.sh',
            icons: ['https://uniter.sh/icon.png']
          }
        })
      });
    }
    
    const session: WebWalletSession = {
      address: result.accounts[0],
      chainId: result.chainId,
      chainName: getChainName(result.chainId),
      sendTransaction: createSendTransaction()
    };
    
    return session;
  } catch (error) {
    console.error('Wallet connection failed:', error);
    throw new Error('Failed to connect wallet. Please make sure your wallet is installed and unlocked, or scan the QR code with your mobile wallet.');
  }
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet(): Promise<void> {
  try {
    // Disconnect from Wagmi
    await disconnect(config);
    console.log('✅ Wallet disconnected successfully');
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
      chainName: getChainName(chainId),
      sendTransaction: createSendTransaction()
    };
  }
  return null;
}

/**
 * Restore session (check if wallet is already connected)
 */
export async function restoreSession(): Promise<WebWalletSession | null> {
  try {
    // Initialize Wagmi and attempt reconnection first
    await initializeWagmi();
    
    // Wait a bit for Wagmi to settle after reconnection
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if wallet is connected after initialization
    if (isWalletConnected()) {
      const account = getAccount(config);
      const chainId = getChainId(config);
      
      console.log('✅ Wallet session restored:', account.address);
      return {
        address: account.address || '',
        chainId: chainId,
        chainName: getChainName(chainId)
      };
    }
    
    console.log('ℹ️ No existing wallet session found');
    return null;
  } catch (error) {
    console.log('❌ Session restoration failed:', error);
    return null;
  }
}
