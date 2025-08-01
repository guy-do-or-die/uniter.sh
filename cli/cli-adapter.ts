import { EnvironmentAdapter, TerminalEnvironment } from '../shared/engine.js';
import { connectWallet, disconnectWallet, isWalletConnected, getCurrentSession, restoreSession } from './wallet.js';
import { unifiedScan, scanMultichain } from '../shared/token-scanner.js';
import { loadConfig } from './config.js';

/**
 * CLI environment adapter - provides full functionality
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
  async scanTokens(session: any, chainId: number): Promise<any> {
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

    // Use the truly unified scanner - same function as web
    const { result } = await unifiedScan(walletSession, config.oneinchApiKey, 5);
    
    // Return result only - let terminal engine handle display (same as web)
    return result;
  }

  async scanTokensMultiChain(session: any): Promise<any> {
    const config = loadConfig();
    if (!config.oneinchApiKey) {
      throw new Error('1inch API key not found in config');
    }
    
    // Use the unified multi-chain scanner - same function as web
    const { results } = await scanMultichain(session, config.oneinchApiKey, config.defaultMinUsdValue || 5);
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
