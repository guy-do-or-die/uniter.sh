import { EnvironmentAdapter, TerminalEnvironment } from '../shared/terminal/index.js';
import { unifiedScan, scanMultichain } from '../shared/portfolio-display.js';
import { loadBrowserConfig } from './config.js';
import { 
  connectWallet, 
  disconnectWallet, 
  isWalletConnected, 
  getCurrentSession, 
  restoreSession,
} from './wallet.js';

// Debug environment variables
console.log('Environment variables loaded:', {
  REOWN_PROJECT_ID: import.meta.env.VITE_REOWN_PROJECT_ID ? '✅ Present' : '❌ Missing',
  WALLETCONNECT_PROJECT_ID: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ? '✅ Present' : '❌ Missing',
  ONEINCH_API_KEY: import.meta.env.VITE_ONEINCH_API_KEY ? '✅ Present' : '❌ Missing'
});

/**
 * Web environment adapter - provides real wallet functionality via Wagmi
 */
export class WebAdapter implements EnvironmentAdapter {
  private currentSession: any = null;

  // Wallet operations - delegated to wallet module
  async connectWallet(): Promise<any> {
    const session = await connectWallet();
    this.currentSession = session;
    return session;
  }

  async disconnectWallet(): Promise<void> {
    await disconnectWallet();
    this.currentSession = null;
  }

  isWalletConnected(): boolean {
    return isWalletConnected();
  }

  getCurrentSession(): any {
    return getCurrentSession() || this.currentSession;
  }

  async restoreSession(): Promise<any> {
    const session = await restoreSession();
    if (session) {
      this.currentSession = session;
    }
    return session;
  }

  // Token operations - using platform-agnostic scanning logic with browser API
  async scanTokens(session: any, chainId: number, onProgress?: (progress: any) => void): Promise<any> {
    if (!session || !session.address) {
      throw new Error('No wallet session available');
    }
    
    // Use browser-compatible config loader
    const browserConfig = loadBrowserConfig();
    
    if (!browserConfig.oneinchApiKey) {
      throw new Error('1inch API key not found. Please set VITE_ONEINCH_API_KEY environment variable.');
    }
    
    // Use the same session format as CLI
    const walletSession = {
      address: session.address,
      chainId: chainId,
      client: null, // Not needed for web environment
      topic: '' // Not needed for web environment
    };
    
    // Use the truly unified scanner with progress callback
    const { result } = await unifiedScan(walletSession, browserConfig.oneinchApiKey, 5, onProgress);
    return result;
  }

  async scanTokensMultiChain(session: any, onProgress?: (progress: any) => void): Promise<any> {
    if (!session || !session.address) {
      throw new Error('No wallet session available');
    }
    
    // Use browser-compatible config loader
    const browserConfig = loadBrowserConfig();
    
    if (!browserConfig.oneinchApiKey) {
      throw new Error('1inch API key not found. Please set VITE_ONEINCH_API_KEY environment variable.');
    }
    
    // Use the same session format as CLI
    const walletSession = {
      address: session.address,
      chainId: 0, // Not used for multi-chain scan
      client: null, // Not needed for web environment
      topic: '', // Not needed for web environment
      isDemo: session.isDemo || false // Pass through demo mode flag
    };
    
    // Check if this is a demo session
    if (session.isDemo) {
      console.log('Running in demo mode with address:', session.address);
    }
    
    // Use unified multi-chain scanner with progress callback
    const { results } = await scanMultichain(walletSession, browserConfig.oneinchApiKey, browserConfig.defaultMinUsdValue || 5, onProgress);
    return results;
  }

  // Environment info
  getEnvironment(): TerminalEnvironment {
    return {
      isNode: false,
      isBrowser: true,
      canConnectWallet: true,  // Real wallet connection via Wagmi
      canScanTokens: true      // Real token scanning via platform-agnostic core
    };
  }
}
