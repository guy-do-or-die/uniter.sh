import { sdk } from '@farcaster/miniapp-sdk';

/**
 * Farcaster miniapp utilities and integration helpers
 */
export class MiniappIntegration {
  private static _instance: MiniappIntegration;
  private _isInitialized = false;
  private _isFarcasterContext = false;

  private constructor() {}

  static getInstance(): MiniappIntegration {
    if (!MiniappIntegration._instance) {
      MiniappIntegration._instance = new MiniappIntegration();
    }
    return MiniappIntegration._instance;
  }

  /**
   * Initialize Farcaster integration and detect if running in Farcaster context
   */
  async initialize(): Promise<void> {
    if (this._isInitialized) return;

    try {
      // Try to access Farcaster context to detect if we're in a miniapp
      const context = await sdk.context;
      this._isFarcasterContext = !!context;
      console.log('Farcaster context detected:', this._isFarcasterContext);
    } catch (error) {
      this._isFarcasterContext = false;
      console.log('Not running in Farcaster context');
    }

    this._isInitialized = true;
  }

  /**
   * Signal to Farcaster that the app is ready to display
   */
  async signalReady(): Promise<void> {
    // Always try to call ready() - Farcaster needs this to hide splash screen
    // If we're not in Farcaster context, this will fail silently
    try {
      await sdk.actions.ready();
      console.log('Farcaster miniapp ready signal sent successfully');
    } catch (error) {
      // This is expected when not running in Farcaster context
      console.log('Ready signal not needed (not in Farcaster context)');
    }
  }

  /**
   * Check if the app is running in a Farcaster context
   */
  get isFarcasterContext(): boolean {
    return this._isFarcasterContext;
  }

  /**
   * Get Farcaster user context if available
   */
  async getUserContext() {
    if (!this._isFarcasterContext) {
      return null;
    }

    try {
      const context = await sdk.context;
      return {
        user: context.user,
        location: context.location,
        client: context.client
      };
    } catch (error) {
      console.error('Failed to get Farcaster user context:', error);
      return null;
    }
  }

  /**
   * Open a URL (if in Farcaster context)
   */
  async openUrl(url: string): Promise<void> {
    if (!this._isFarcasterContext) {
      console.log('Not in Farcaster context, cannot open URL');
      return;
    }

    try {
      await sdk.actions.openUrl(url);
      console.log('URL opened:', url);
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  }

  /**
   * Close the miniapp (if in Farcaster context)
   */
  async close(): Promise<void> {
    if (!this._isFarcasterContext) {
      console.log('Not in Farcaster context, cannot close miniapp');
      return;
    }

    try {
      await sdk.actions.close();
    } catch (error) {
      console.error('Failed to close miniapp:', error);
    }
  }
}

// Export singleton instance
export const miniapp = MiniappIntegration.getInstance();
