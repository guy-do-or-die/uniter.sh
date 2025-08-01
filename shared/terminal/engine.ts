import { getChainId, getChainName, getSupportedChains } from '../chains.js';
import { generateTokenScanOutput } from './display.js';
import chalk from 'chalk';

import { logoData } from './logo.js';

import type { TerminalOutput, TerminalCommand, EnvironmentAdapter, TerminalRenderer } from './types.js';
import type { ScanProgress } from '../types.js';



export const DELIMITER = {
  type: 'info',
  content:'-'.repeat(47)
} as TerminalOutput;


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
    if (this.renderer) {
      // Get colors based on environment
      const colors = this.getTerminalColors();
      
      return [
        { type: 'info', content: 'Welcome to Uniter.sh - Unified DeFi Terminal' },
        { type: 'info', content: 'Type "help" to see available commands.' }
      ];
    }
    
    return [
      { type: 'info', content: '▶ UNITER.SH - Unified DeFi Terminal' },
      { type: 'info', content: 'Type "help" to see available commands.' }
    ];
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
        name: 'connect',
        description: 'Connect wallet via WalletConnect',
        handler: this.handleConnect.bind(this)
      },
      {
        name: 'disconnect',
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
    
    outputs.push(
      DELIMITER,
      {
        type: 'info',
        content: `\x1b[1m\x1b[96m Uniter.sh ${envInfo} — Make tokens unitETH!\x1b[0m`
      },
      {
        type: 'info',
        content: `\n   Type "help" to see available commands`
      },
      DELIMITER
    );
    
    return outputs;
  }

  /**
   * Get current prompt string
   */
  getPrompt(): string {
    const session = this.adapter.getCurrentSession();
    if (session && session.address) {

      const userIdentifier = session.ensName || `${session.address.slice(0, 6)}...${session.address.slice(-4)}`;
      return `${userIdentifier}@uniter.sh> `;
    }
    return 'guest@uniter.sh> ';
  }

  // Command handlers

  private async handleHelp(): Promise<TerminalOutput[]> {
    const env = this.adapter.getEnvironment();
    const output: TerminalOutput[] = [{
      type: 'info',
      content: 'Available Commands:\n'
    }];

    const uniqueCommands = Array.from(new Set(Array.from(this.commands.values())));
    
    uniqueCommands.forEach(cmd => {
      const aliases = cmd.aliases ? ` (${cmd.aliases.join(', ')})` : '';
      const args = cmd.args ? ` ${cmd.args.join(' ')}` : '';
      output.push({
        type: 'text',
        content: `  ${cmd.name}${args}${aliases} - ${cmd.description}`
      });
    });

    output.push({
      type: 'info',
      content: '\nExamples:\n  connect\n  scan polygon\n  multichain\n  help'
    });

    if (!env.canConnectWallet) {
      output.push({
        type: 'warning',
        content: '\nDemo Mode: Limited functionality in web environment.\nFor full wallet integration, use the CLI version.'
      });
    }

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
      return [{
        type: 'success',
        content: 'Wallet connected successfully'
      }, {
        type: 'info',
        content: `Address: ${session.address}`
      }, {
        type: 'info',
        content: `Chain: ${session.chainName || 'Unknown'} (${session.chainId || 'Unknown'})`
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
        content: 'Wallet disconnected successfully'
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
      return [{
        type: 'success',
        content: 'Wallet connected'
      }, {
        type: 'info',
        content: `Address: ${session?.address || 'Unknown'}`
      }, {
        type: 'info',
        content: `Chain: ${session?.chainName || 'Unknown'} (${session?.chainId || 'Unknown'})`
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
        content: '⚠️  Token scanning not available in web environment.\nThis is a demo terminal. Use the CLI version for real token scanning.'
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
        content: 'Please specify a chain. Usage: scan <chain>\nExample: scan polygon'
      }];
    }

    try {
      const chainId = getChainId(chainInput);
      const chainName = getChainName(chainId);

      // Display logo and loading message
      if (this.renderer) {
        const colors = this.getTerminalColors();
        this.renderer.writeln(`Starting scan on ${chainName}...`);
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
        content: `Scan failed: ${error instanceof Error ? error.message : String(error)}`
      }];
    }
  }

  private async handleMultichain(): Promise<TerminalOutput[]> {
    const env = this.adapter.getEnvironment();
    
    if (!env.canScanTokens) {
      return [{
        type: 'warning',
        content: '⚠️  Multichain scanning not available in web environment.\nThis is a demo terminal. Use the CLI version for real multichain scanning.'
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
          this.renderer.writeln(`💰 Total Portfolio Value: $${totalValue.toFixed(2)}`);
          this.renderer.writeln(`🪙 Total Tokens: ${totalTokens}`);
          this.renderer.writeln(`⛓️ Chains Scanned: ${results.length}`);
        }
      } else {
        if (this.renderer) {
          this.renderer.writeln('❌ No tokens found across all chains');
        }
      }
      
      output.push({
        type: 'success',
        content: '✅ Multichain scan complete!'
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
      content: '⛓️  Supported Chains:\n'
    }];

    chains.forEach((chain, index) => {
      output.push({
        type: 'text',
        content: `  ${(index + 1).toString().padStart(2)}. ${chain.name.padEnd(20)} (ID: ${chain.id})`
      });
    });

    output.push({
      type: 'info',
      content: `\n📊 Total: ${chains.length} chains supported`
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
