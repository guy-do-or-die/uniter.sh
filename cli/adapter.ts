import { EnvironmentAdapter, TerminalEnvironment } from '../core/terminal/index.js';
import { connectWallet, disconnectWallet, isWalletConnected, getCurrentSession, restoreSession } from './wallet.js';
import { unifiedScan, scanMultichain } from '../core/portfolio-display.js';
import { loadConfig } from './config.js';

/**
 * CLI environment adapter
 */
export class CliAdapter implements EnvironmentAdapter {
  
  // Wallet operations
  async connectWallet(): Promise<any> {
    return await connectWallet();
  }

  async disconnectWallet(): Promise<void> {
    return await disconnectWallet();
  }

  isWalletConnected(): boolean {
    return isWalletConnected();
  }

  getCurrentSession(): any {
    return getCurrentSession();
  }

  async restoreSession(): Promise<any> {
    return await restoreSession();
  }

  // Token operations
  async scanTokens(session: any, chainId: number, onProgress?: (progress: any) => void): Promise<any> {
    // Load API key from config
    const config = loadConfig();
    if (!config.oneinchApiKey) {
      throw new Error('1inch API key not configured');
    }

    // Create proper session with chainId
    const walletSession = {
      address: session.address,
      chainId: chainId,
      client: session.client || null,
      topic: session.topic || ''
    };

    // Use the truly unified scanner with progress callback
    const { result } = await unifiedScan(walletSession, config.oneinchApiKey, 5, onProgress);
    
    // Return result only - let terminal engine handle display (same as web)
    return result;
  }

  async scanTokensMultiChain(session: any, onProgress?: (progress: any) => void): Promise<any> {
    const config = loadConfig();
    if (!config.oneinchApiKey) {
      throw new Error('1inch API key not found in config');
    }
    
    // Use the unified multi-chain scanner with progress callback
    const { results } = await scanMultichain(session, config.oneinchApiKey, config.defaultMinUsdValue || 5, onProgress);
    return results;
  }

  // Environment info
  getEnvironment(): TerminalEnvironment {
    return {
      isNode: true,
      isBrowser: false,
      canConnectWallet: true,
      canScanTokens: true
    };
  }
}
