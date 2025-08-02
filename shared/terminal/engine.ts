import { getChainId, getChainName, getNetworkIdentifier, getSupportedChains } from '../chains.js';
import { generateTokenScanOutput, formatUsdValue } from './display.js';
import { formatAddressWithEns, formatAddressWithEnsForConnection } from '../api.js';
import chalk from 'chalk';

import { logoData } from './logo.js';

import type { TerminalOutput, TerminalCommand, EnvironmentAdapter, TerminalRenderer, TerminalEnvironment } from './types.js';
import type { ScanProgress } from '../types.js';



export const DELIMITER = {
  type: 'info',
  content:'-'.repeat(60)
} as TerminalOutput;

// Width constraints for different environments
const MINIAPP_MAX_WIDTH = 50; // Maximum visible width in Farcaster miniapp
const DESKTOP_MAX_WIDTH = 60; // Standard desktop width

/**
 * Detect if running in Farcaster miniapp environment
 */
function isMiniappEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 500 || window.innerHeight < 600;
}

/**
 * Format text with width constraints for current environment
 */
function formatForEnvironment(text: string, maxWidth?: number): string {
  const targetWidth = maxWidth || (isMiniappEnvironment() ? MINIAPP_MAX_WIDTH : DESKTOP_MAX_WIDTH);
  
  // If text fits within width, return as-is
  if (text.length <= targetWidth) {
    return text;
  }
  
  // For longer text, try to abbreviate intelligently
  if (text.includes('complete')) {
    return text.replace('complete', '✓').substring(0, targetWidth);
  }
  
  // Truncate with ellipsis
  return text.substring(0, targetWidth - 3) + '...';
}


/**
 * Unified terminal engine that works in both CLI and web environments
 */
export class UnifiedTerminalEngine {
  private commands: Map<string, TerminalCommand> = new Map();
  private adapter: EnvironmentAdapter;
  private renderer?: TerminalRenderer;
  private progressColorIndex: number = 0;

  constructor(adapter: EnvironmentAdapter) {
    this.adapter = adapter;
    this.initializeCommands();
  }

  /**
   * Set the renderer for interactive progress updates
   */
  setRenderer(renderer: TerminalRenderer): void {
    this.renderer = renderer;
  }

  /**
   * Display startup logo and welcome message
   */
  displayStartupLogo(): TerminalOutput[] {
    const output: TerminalOutput[] = [];
    
    if (this.renderer) {
      // Get colors based on environment
      const colors = this.getTerminalColors();
      
      output.push(
        { type: 'info', content: 'Welcome to Uniter.sh - Unified DeFi Terminal' },
        { type: 'info', content: 'Type "help" to see available commands.' }
      );
    } else {
      output.push(
        { type: 'info', content: '▶ UNITER.SH - Unified DeFi Terminal' },
        { type: 'info', content: 'Type "help" to see available commands.' }
      );
    }
    
    // Check for existing wallet connection and display status
    const env = this.adapter.getEnvironment();
    if (env.canConnectWallet && this.adapter.isWalletConnected()) {
      const session = this.adapter.getCurrentSession();
      if (session) {
        const shortAddress = `${session.address.slice(0, 6)}...${session.address.slice(-4)}`;
        output.push(
          { type: 'info', content: '' },
          { type: 'success', content: `✅ Wallet connected: ${shortAddress}` },
          { type: 'info', content: `🌐 Network: ${session.chainName}` }
        );
      }
    }
    
    return output;
  }

  /**
   * Get terminal colors based on environment
   */
  private getTerminalColors(): { primary: string; accent: string; reset: string } {
    // Check if we're in a CLI environment with chalk support
    if (typeof process !== 'undefined' && process.stdout && process.stdout.isTTY) {
      // CLI environment - use ANSI colors
      return {
        primary: '\x1b[36m', // Cyan
        accent: '\x1b[94m',   // Bright blue
        reset: '\x1b[0m'     // Reset
      };
    } else {
      // Web environment - no colors for now (xterm.js handles this differently)
      return {
        primary: '',
        accent: '',
        reset: ''
      };
    }
  }

  /**
   * Get vivid rainbow color functions for progress messages
   */
  private getPastelRainbowColors(): Array<(text: string) => string> {
    return [
      chalk.magenta,         // Vivid magenta
      chalk.red,             // Vivid red
      chalk.hex('#FF6B35'),  // Orange-red
      chalk.hex('#FF8C00'),  // Dark orange
      chalk.yellow,          // Vivid yellow
      chalk.hex('#9AFF9A'),  // Light green
      chalk.green,           // Vivid green
      chalk.hex('#00FF7F'),  // Spring green
      chalk.cyan,            // Vivid cyan
      chalk.hex('#00BFFF'),  // Deep sky blue
      chalk.blue,            // Vivid blue
      chalk.hex('#4169E1'),  // Royal blue
      chalk.hex('#8A2BE2'),  // Blue violet
      chalk.hex('#9932CC'),  // Dark orchid
    ];
  }

  /**
   * Get next pastel rainbow color function and advance the index
   */
  private getNextPastelColorFunction(): (text: string) => string {
    const colorFunctions = this.getPastelRainbowColors();
    const colorFunction = colorFunctions[this.progressColorIndex % colorFunctions.length];
    this.progressColorIndex++;
    return colorFunction;
  }

  /**
   * Apply pastel rainbow color to a progress message
   */
  private colorizeProgressMessage(message: string): string {
    // Enable colors for both CLI and web environments
    // xterm.js supports ANSI colors very well
    
    // Force chalk to always use colors
    chalk.level = 3; // Force truecolor support
    
    const colorFunction = this.getNextPastelColorFunction();
    const coloredMessage = colorFunction(message);
    
    return coloredMessage;
  }

  /**
   * Initialize all available commands
   */
  private initializeCommands(): void {
    const commands: TerminalCommand[] = [
      {
        name: 'help',
        description: 'Show available commands',
        aliases: ['h', '?'],
        handler: this.handleHelp.bind(this)
      },
      {
        name: 'about',
        aliases: ['a'],
        description: 'About uniter.sh',
        handler: this.handleAbout.bind(this)
      },
      {
        name: 'connect',
        description: 'Connect wallet via WalletConnect',
        aliases: ['c'],
        handler: this.handleConnect.bind(this)
      },
      {
        name: 'disconnect',
        aliases: ['d'],
        description: 'Disconnect current wallet',
        handler: this.handleDisconnect.bind(this)
      },
      {
        name: 'status',
        description: 'Show wallet connection status',
        aliases: ['st'],
        handler: this.handleStatus.bind(this)
      },
      {
        name: 'scan',
        description: 'Scan tokens on specific chain',
        aliases: ['s'],
        args: ['[chain]'],
        handler: this.handleScan.bind(this)
      },
      {
        name: 'multichain',
        description: 'Scan tokens across all chains',
        aliases: ['mc', 'all'],
        handler: this.handleMultichain.bind(this)
      },
      {
        name: 'chains',
        aliases: ['ch'],
        description: 'List supported chains',
        handler: this.handleChains.bind(this)
      },
      {
        name: 'clear',
        description: 'Clear terminal screen',
        aliases: ['cls'],
        handler: this.handleClear.bind(this)
      },
      {
        name: 'exit',
        description: 'Exit uniter.sh',
        aliases: ['quit', 'q'],
        handler: this.handleExit.bind(this)
      }
    ];

    // Register commands and aliases
    commands.forEach(cmd => {
      this.commands.set(cmd.name, cmd);
      if (cmd.aliases) {
        cmd.aliases.forEach(alias => {
          this.commands.set(alias, cmd);
        });
      }
    });
  }

  /**
   * Execute a command with arguments
   */
  async executeCommand(input: string): Promise<TerminalOutput[]> {
    const parts = input.trim().split(/\s+/);
    const commandName = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    if (!commandName) {
      return [];
    }

    const command = this.commands.get(commandName);
    if (!command) {
      return [{
        type: 'error',
        content: `Unknown command: ${commandName}. Type 'help' for available commands.`
      }];
    }

    try {
      return await command.handler(args);
    } catch (error) {
      return [{
        type: 'error',
        content: `Command failed: ${error instanceof Error ? error.message : String(error)}`
      }];
    }
  }

  /**
   * Get autocomplete suggestions for partial input
   */
  getAutocompleteSuggestions(input: string): string[] {
    const parts = input.trim().split(/\s+/);
    const commandName = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    // If we're still typing the command name
    if (parts.length <= 1) {
      const allCommands = Array.from(new Set(Array.from(this.commands.keys())));
      return allCommands
        .filter(cmd => cmd.startsWith(commandName || ''))
        .sort();
    }

    // Command-specific argument completion
    const command = this.commands.get(commandName);
    if (!command) return [];

    // Autocomplete for scan command (chain names)
    if (command.name === 'scan' && args.length === 1) {
      const chains = getSupportedChains();
      const chainNames = chains.map(c => c.name.toLowerCase().replace(/\s+/g, ''));
      const partialChain = args[0]?.toLowerCase() || '';
      return chainNames
        .filter(chain => chain.startsWith(partialChain))
        .sort();
    }

    return [];
  }

  /**
   * Complete the input with the best suggestion
   */
  completeInput(input: string): string {
    const suggestions = this.getAutocompleteSuggestions(input);
    if (suggestions.length === 0) return input;

    const parts = input.trim().split(/\s+/);
    const lastPart = parts[parts.length - 1] || '';
    
    // Find the best match (exact prefix match)
    const bestMatch = suggestions.find(suggestion => 
      suggestion.toLowerCase().startsWith(lastPart.toLowerCase())
    );

    if (bestMatch) {
      // Replace the last part with the completed suggestion
      const completedParts = [...parts.slice(0, -1), bestMatch];
      return completedParts.join(' ');
    }

    return input;
  }

  /**
   * Get startup banner with logo
   */
  getStartupBanner(): TerminalOutput[] {
    const env = this.adapter.getEnvironment();
    const envInfo = env.isBrowser ? 'Web Terminal' : 'CLI Terminal';
    
    const outputs: TerminalOutput[] = [];
    
    if (logoData) {
      outputs.push({
        type: 'banner',
        content: logoData
      });
    }
   
    const uniterLink = `\x1b]8;;https://uniter.sh\x1b\\\x1b[4m\x1b[36muniter.sh\x1b[0m\x1b]8;;\x1b\\`;
    const oneInchLink = `\x1b]8;;https://1inch.io\x1b\\\x1b[4m\x1b[36m1inch\x1b[0m\x1b]8;;\x1b\\`;

    outputs.push(
      DELIMITER,
      {
        type: 'info',
        content: `\x1b[96m  ${uniterLink} ${envInfo} — Make tokens unit\x1b[1m\x1b[97mETH\x1b[0m with \x1b[96m${oneInchLink}!\x1b[0m`
      },
      {
        type: 'info',
        content: `\n          Type "help" to see available commands`
      },
      DELIMITER
    );
    
    return outputs;
  }

  /**
   * Get current prompt string
   */
  async getPrompt(): Promise<string> {
    if (this.adapter.isWalletConnected()) {
      const session = this.adapter.getCurrentSession();
      if (session?.address) {
        try {
          const userIdentifier = await formatAddressWithEns(session.address);
          // Style the prompt with bold user identifier and darker domain
          return `\x1b[1m\x1b[36m${userIdentifier}\x1b[0m\x1b[90m@uniter.sh\x1b[0m> `;
        } catch (error) {
          // Fallback to short address if ENS resolution fails
          const userIdentifier = `${session.address.slice(0, 6)}...${session.address.slice(-4)}`;
          return `\x1b[1m\x1b[36m${userIdentifier}\x1b[0m\x1b[90m@uniter.sh\x1b[0m> `;
        }
      }
    }
    return '\x1b[36mguest\x1b[90m@uniter.sh\x1b[0m> ';
  }

  /**
   * Reset session state (for web terminal exit handling)
   */
  resetSession(): void {
    // Reset progress color index for fresh start
    this.progressColorIndex = 0;
    
    // Disconnect wallet if connected (web environment only)
    if (this.adapter.isWalletConnected()) {
      try {
        this.adapter.disconnectWallet();
      } catch (error) {
        // Ignore disconnect errors during reset
      }
    }
  }

  /**
   * Get environment information
   */
  getEnvironment(): TerminalEnvironment {
    return this.adapter.getEnvironment();
  }

  /**
   * Restore session (for web terminal startup)
   */
  async restoreSession(): Promise<any> {
    return await this.adapter.restoreSession();
  }

  // Command handlers

  private async handleHelp(): Promise<TerminalOutput[]> {
    const env = this.adapter.getEnvironment();
    const output: TerminalOutput[] = [];

    // Header
    output.push({
      type: 'info',
      content: '\n\x1b[36mAvailable Commands:\x1b[0m\n'
    });

    // Commands list with better formatting
    const uniqueCommands = Array.from(new Set(Array.from(this.commands.values())));
    
    uniqueCommands.forEach(cmd => {
      const aliases = cmd.aliases ? ` (${cmd.aliases.join(', ')})` : '';
      const args = cmd.args ? ` ${cmd.args.join(' ')}` : '';
      output.push({
        type: 'text',
        content: `   \x1b[1m${cmd.name}\x1b[0m${args}${aliases}\r\n     └─ ${cmd.description}\r\n`
      });
    });

    // Examples section
    output.push({
      type: 'info',
      content: '\n\x1b[33mExamples:\x1b[0m\r\n'
    });
    
    output.push({
      type: 'text',
      content: '   \x1b[1mconnect\x1b[0m              Connect your wallet\r\n   \x1b[1mscan base\x1b[0m            Scan tokens on Base\r\n   \x1b[1mmultichain\x1b[0m           Scan all supported chains\r\n   \x1b[1mstatus\x1b[0m               Check connection status\r\n'
    });

    // Navigation tips
    output.push({
      type: 'info',
      content: '\n\x1b[32mNavigation Tips:\x1b[0m\r\n'
    });
    
    output.push({
      type: 'text',
      content: '   \x1b[1mTab\x1b[0m                  Auto-complete commands\r\n   \x1b[1m↑/↓ Arrow Keys\x1b[0m       Browse command history\r\n   \x1b[1mCtrl+C (twice)\x1b[0m     Graceful exit\r\n       Force quit\r\n   \x1b[1mexit, quit, or q\x1b[0m'
    });

    if (!env.canConnectWallet) {
      output.push({
        type: 'warning',
        content: '\nDemo Mode: Limited functionality in web environment.\nFor full wallet integration, use the CLI version.'
      });
    }

    return output;
  }

  private async handleAbout(): Promise<TerminalOutput[]> {
    const env = this.adapter.getEnvironment();
    const output: TerminalOutput[] = [];

    // Description
    output.push({
      type: 'text',
      content: '\r\n\x1b[36mUnified DeFi Terminal\x1b[0m - Make tokens unitETH across all chains\r\n'
    });

    const uniterLink = `\x1b]8;;https://uniter.sh\x1b\\\x1b[4m\x1b[36muniter.sh\x1b[0m\x1b]8;;\x1b\\`;
    const oneInchLink = `\x1b]8;;https://1inch.io\x1b\\\x1b[4m\x1b[36m1inch.io\x1b[0m\x1b]8;;\x1b\\`;
    const githubLink = `\x1b]8;;https://github.com/guy-do-or-die/uniter.sh\x1b\\\x1b[4m\x1b[36mgithub.com/guy-do-or-die/uniter.sh\x1b[0m\x1b]8;;\x1b\\`;

    output.push({
      type: 'text',
      content: `\r\nPowered by         ${oneInchLink} 🦄\r\n`
    });

    if (env.isBrowser) {
      output.push({
        type: 'text',
        content: '\r\nTry CLI version    \x1b[33mnpm install -g uniter.sh\x1b[0m\r\n'
      });
    } else {
      output.push({
        type: 'text',
        content: `\r\nTry web version    ${uniterLink}\r\n`
      });
    }

    output.push({
      type: 'text',
      content: `\r\nThe code           ${githubLink}\r\n`
    });

    return output;
  }

  private async handleConnect(): Promise<TerminalOutput[]> {
    const env = this.adapter.getEnvironment();
    
    if (!env.canConnectWallet) {
      return [{
        type: 'warning',
        content: 'Wallet connection not available in web environment.\nThis is a demo terminal. Use the CLI version for real wallet connection.'
      }];
    }

    if (this.adapter.isWalletConnected()) {
      const session = this.adapter.getCurrentSession();
      return [{
        type: 'warning',
        content: `Already connected to ${session?.address || 'wallet'}`
      }];
    }

    try {
      const session = await this.adapter.connectWallet();
      const networkId = getNetworkIdentifier(session.chainId);
      
      // Try to resolve ENS name for better display (with address for connection info)
      let addressDisplay = session.address;
      try {
        addressDisplay = await formatAddressWithEnsForConnection(session.address);
      } catch (error) {
        // Keep original address if ENS resolution fails
      }
      
      return [{
        type: 'success',
        content: formatForEnvironment('Wallet connected successfully')
      }, {
        type: 'info',
        content: `Address: ${addressDisplay}`
      }, {
        type: 'info',
        content: `Network: ${networkId} (${session.chainId})`
      }];
    } catch (error) {
      return [{
        type: 'error',
        content: `Connection failed: ${error instanceof Error ? error.message : String(error)}`
      }];
    }
  }

  private async handleDisconnect(): Promise<TerminalOutput[]> {
    const env = this.adapter.getEnvironment();
    
    if (!env.canConnectWallet) {
      return [{
        type: 'warning',
        content: 'This is a demo terminal. No real wallet to disconnect.'
      }];
    }

    if (!this.adapter.isWalletConnected()) {
      return [{
        type: 'warning',
        content: 'No wallet currently connected'
      }];
    }

    try {
      await this.adapter.disconnectWallet();
      return [{
        type: 'success',
        content: formatForEnvironment('Wallet disconnected successfully')
      }];
    } catch (error) {
      return [{
        type: 'error',
        content: `Disconnect failed: ${error instanceof Error ? error.message : String(error)}`
      }];
    }
  }

  private async handleStatus(): Promise<TerminalOutput[]> {
    const env = this.adapter.getEnvironment();
    
    if (!env.canConnectWallet) {
      return [{
        type: 'info',
        content: 'Web Terminal Demo Mode'
      }, {
        type: 'warning',
        content: 'No real wallet connection available.\nUse CLI version for full functionality.'
      }];
    }

    if (this.adapter.isWalletConnected()) {
      const session = this.adapter.getCurrentSession();
      const chainName = session?.chainId ? getChainName(session.chainId) : 'Unknown';
      return [{
        type: 'success',
        content: 'Wallet connected'
      }, {
        type: 'info',
        content: `Address: ${session?.address || 'Unknown'}`
      }, {
        type: 'info',
        content: `Chain: ${chainName} (${session?.chainId || 'Unknown'})`
      }];
    } else {
      return [{
        type: 'warning',
        content: '\nNo wallet connected'
      }, {
        type: 'warning',
        content: 'Use "connect" to connect your wallet'
      }];
    }
  }

  private async handleScan(args: string[]): Promise<TerminalOutput[]> {
    const env = this.adapter.getEnvironment();
    
    if (!env.canScanTokens) {
      return [{
        type: 'warning',
        content: formatForEnvironment('⚠️  Token scanning not available in web environment.\nThis is a demo terminal. Use the CLI version for real token scanning.')
      }];
    }

    const session = this.adapter.getCurrentSession();
    if (!session) {
      return [{
        type: 'error',
        content: 'No wallet connected. Use "connect" first.'
      }];
    }

    const chainInput = args[0];
    if (!chainInput) {
      return [{
        type: 'error',
        content: 'Please specify a chain. Usage: scan <chain>\n\n\rExample: scan polygon'
      }];
    }

    try {
      const chainId = getChainId(chainInput);
      const chainName = getChainName(chainId);

      const output: TerminalOutput[] = [];

      // Create progress callback for interactive updates
      const onProgress = (progress: ScanProgress) => {
        if (this.renderer) {
          if (progress.phase !== 'pricing') {
            // Major phases: display immediately as permanent output, then clear progress
            this.renderer.clearProgress();
            const colorizedMessage = this.colorizeProgressMessage(progress.message);
            this.renderer.writeln(colorizedMessage);
          } else {
            // Individual token pricing: show as in-place updates only
            const colorizedMessage = this.colorizeProgressMessage(progress.message);
            this.renderer.updateProgress(colorizedMessage);
          }
        }
      };

      const scanResult = await this.adapter.scanTokens(session, chainId, onProgress);
      
      // Clear progress display
      if (this.renderer) {
        this.renderer.clearProgress();
      }
      
      // Display results line by line as they're generated
      const displayOutput = generateTokenScanOutput(scanResult);
      if (this.renderer) {
        displayOutput.forEach(item => {
          this.renderer!.writeln(item.content);
        });
      }

      return output;
    } catch (error) {
      // Clear progress on error
      if (this.renderer) {
        this.renderer.clearProgress();
      }
      return [{
        type: 'error',
        content: `Scan failed\n\r${error instanceof Error ? error.message : String(error)}`
      }];
    }
  }

  private async handleMultichain(): Promise<TerminalOutput[]> {
    const env = this.adapter.getEnvironment();
    
    if (!env.canScanTokens) {
      return [{
        type: 'warning',
        content: formatForEnvironment('⚠️  Multichain scanning not available in web environment.\nThis is a demo terminal. Use the CLI version for real multichain scanning.')
      }];
    }

    const session = this.adapter.getCurrentSession();
    if (!session) {
      return [{
        type: 'error',
        content: 'No wallet connected. Use "connect" first.'
      }];
    }

    try {
      // Display logo and loading message
      if (this.renderer) {
        const colors = this.getTerminalColors();
        this.renderer.writeln('Starting multichain scan across all supported chains...');
      }

      const output: TerminalOutput[] = [];

      // Create progress callback for interactive updates
      const onProgress = (progress: ScanProgress) => {
        if (this.renderer) {
          if (progress.phase !== 'pricing') {
            // Major phases: display immediately as permanent output, then clear progress
            this.renderer.clearProgress();
            const colorizedMessage = this.colorizeProgressMessage(progress.message);
            this.renderer.writeln(colorizedMessage);
          } else {
            // Individual token pricing: show as in-place updates only
            const colorizedMessage = this.colorizeProgressMessage(progress.message);
            this.renderer.updateProgress(colorizedMessage);
          }
        }
      };

      // Get scan results from adapter with progress callback
      const results = await this.adapter.scanTokensMultiChain(session, onProgress);
      
      // Clear progress display
      if (this.renderer) {
        this.renderer.clearProgress();
      }
      
      // Display results for each chain line by line
      if (results && results.length > 0) {
        results.forEach((result: any) => {
          // Display chain header immediately
          if (this.renderer) {
            this.renderer.writeln(`\n🔗 ${result.chainName || 'Chain ' + result.chainId} Results:`);
          }
          
          // Display chain results line by line
          const displayOutput = generateTokenScanOutput(result);
          if (this.renderer) {
            displayOutput.forEach(item => {
              this.renderer!.writeln(item.content);
            });
          }
        });
        
        // Display multi-chain summary line by line
        const totalValue = results.reduce((sum: number, r: any) => sum + (r.totalUSD || 0), 0);
        const totalTokens = results.reduce((sum: number, r: any) => sum + (r.allTokens?.length || 0), 0);
        
        if (this.renderer) {
          this.renderer.writeln('');
          this.renderer.writeln('🌐 Multi-Chain Summary:');
          this.renderer.writeln(`💰 Total Portfolio Value: ${formatUsdValue(totalValue)}`);
          this.renderer.writeln(`🪙 Total Tokens: ${totalTokens.toString().padStart(3)}`);
          this.renderer.writeln(`⛓️ Chains Scanned: ${results.length.toString().padStart(2)}`);
        }
      } else {
        if (this.renderer) {
          this.renderer.writeln(formatForEnvironment('❌ No tokens found across all chains'));
        }
      }
      
      output.push({
        type: 'success',
        content: formatForEnvironment('✅ Multichain scan complete!')
      });

      return output;
    } catch (error) {
      return [{
        type: 'error',
        content: `Multichain scan failed: ${error instanceof Error ? error.message : String(error)}`
      }];
    }
  }

  private async handleChains(): Promise<TerminalOutput[]> {
    const chains = getSupportedChains();
    const output: TerminalOutput[] = [{
      type: 'info',
      content: '\n\x1b[36mSupported Chains:\x1b[0m\n'
    }];

    chains.forEach((chain, index) => {
      const networkId = getNetworkIdentifier(chain.id);
      output.push({
        type: 'text',
        content: `  ${(index + 1).toString().padStart(2)}. \x1b[1m${networkId}\x1b[0m${' '.repeat(12 - networkId.length)}${chain.name} (${chain.id})`
      });
    });

    output.push({
      type: 'info',
      content: `\n\x1b[33mUsage:\x1b[0m Use the \x1b[1mbold identifiers\x1b[0m for commands (e.g., \x1b[1mscan zksync\x1b[0m)\n`
    });

    output.push({
      type: 'info',
      content: `\x1b[32mTotal:\x1b[0m ${chains.length} chains supported`
    });

    return output;
  }

  private async handleClear(): Promise<TerminalOutput[]> {
    return [{
      type: 'text',
      content: '\x1b[2J\x1b[H' // ANSI clear screen
    }];
  }

  private async handleExit(): Promise<TerminalOutput[]> {
    return [{
      type: 'info',
      content: '👋 Thanks for using uniter.sh!'
    }];
  }
}
