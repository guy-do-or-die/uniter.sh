console.log('🚀 main.ts loading...');

import { WebTerminalRenderer } from './terminal.js';
import { miniapp } from './miniapp.js';

console.log('✅ main.ts imports loaded successfully');

/**
 * Initialize the web terminal application
 */
async function initWebTerminal(): Promise<void> {
  try {
    // Check if we're in a Farcaster miniapp context
    const url = new URL(window.location.href);
    const isMiniappContext = url.searchParams.has('miniApp') || 
                            url.pathname.includes('/miniapp') ||
                            url.searchParams.has('fc_miniapp') ||
                            window.location.href.includes('farcaster');
    
    console.log('Miniapp context detected:', isMiniappContext);
    
    // Initialize Farcaster integration
    await miniapp.initialize();
    
    // Initialize the web terminal
    const webTerminal = new WebTerminalRenderer();
    await webTerminal.init();
    
    // Notify Farcaster that the miniapp is ready to display
    await miniapp.signalReady();
    
    // Log user context if available
    const userContext = await miniapp.getUserContext();
    if (userContext) {
      console.log('Farcaster user context:', userContext);
    }
  } catch (error) {
    console.error('Failed to initialize web terminal:', error);
    const terminalElement = document.getElementById('terminal');
    if (terminalElement) {
      terminalElement.innerHTML = `
        <div style="color: #ff7b72; padding: 20px; text-align: center;">
          ❌ Failed to initialize terminal<br>
          <small>${error instanceof Error ? error.message : String(error)}</small>
        </div>
      `;
    }
    
    // Still try to signal ready even if terminal init failed
    try {
      await miniapp.signalReady();
    } catch (farcasterError) {
      console.log('Failed to signal Farcaster ready state');
    }
  }
}

// Start the web terminal when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWebTerminal);
} else {
  initWebTerminal();
}
