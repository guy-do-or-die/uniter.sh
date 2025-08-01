import { WebTerminalRenderer } from './terminal.js';

/**
 * Initialize the web terminal application
 */
async function initWebTerminal(): Promise<void> {
  try {
    const webTerminal = new WebTerminalRenderer();
    await webTerminal.init();
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
  }
}

// Start the web terminal when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWebTerminal);
} else {
  initWebTerminal();
}
