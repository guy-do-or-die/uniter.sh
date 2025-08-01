import { getChainId, getChainName, getSupportedChains } from '../chains.js';
import { generateTokenScanOutput } from './display.js';
import type { TerminalOutput, TerminalCommand, EnvironmentAdapter } from './types.js';

/**
 * Unified terminal engine that works in both CLI and web environments
 */
export class UnifiedTerminalEngine {
  private commands: Map<string, TerminalCommand> = new Map();
  private adapter: EnvironmentAdapter;

  constructor(adapter: EnvironmentAdapter) {
    this.adapter = adapter;
    this.initializeCommands();
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
   * Get startup banner
   */
  getStartupBanner(): TerminalOutput[] {
    const env = this.adapter.getEnvironment();
    const envInfo = env.isBrowser ? 'Web Terminal' : 'CLI Terminal';
    const capabilities = env.canConnectWallet ? 'Full Functionality' : 'Demo Mode';
    
    return [
      {
        type: 'banner',
        content: `Welcome to uniter.sh (${envInfo} - ${capabilities})`
      },
      {
        type: 'info',
        content: 'Type "help" to see available commands'
      }
    ];
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
        content: 'No wallet connected'
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

      const output: TerminalOutput[] = [{
        type: 'info',
        content: `🔄 Scanning ${chainName} for token balances...`
      }];

      const scanResult = await this.adapter.scanTokens(session, chainId);
      
      // Use unified display function for consistent formatting
      const displayOutput = generateTokenScanOutput(scanResult);
      output.push(...displayOutput);

      return output;
    } catch (error) {
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
      const output: TerminalOutput[] = [{
        type: 'info',
        content: '🌐 Starting multichain scan across all supported chains...'
      }];

      // Get scan results from adapter
      const results = await this.adapter.scanTokensMultiChain(session);
      
      // Display results for each chain using unified display logic
      if (results && results.length > 0) {
        results.forEach((result: any) => {
          // Add chain header
          output.push({
            type: 'info',
            content: `\n🔗 ${result.chainName || 'Chain ' + result.chainId} Results:`
          });
          
          // Use unified display function for consistent formatting
          const displayOutput = generateTokenScanOutput(result);
          output.push(...displayOutput);
        });
        
        // Add multi-chain summary
        const totalValue = results.reduce((sum: number, r: any) => sum + (r.totalUSD || 0), 0);
        const totalTokens = results.reduce((sum: number, r: any) => sum + (r.allTokens?.length || 0), 0);
        
        output.push(
          { type: 'info', content: '' },
          { type: 'info', content: '🌐 Multi-Chain Summary:' },
          { type: 'info', content: `💰 Total Portfolio Value: $${totalValue.toFixed(2)}` },
          { type: 'info', content: `🪙 Total Tokens: ${totalTokens}` },
          { type: 'info', content: `⛓️ Chains Scanned: ${results.length}` }
        );
      } else {
        output.push({
          type: 'info',
          content: '❌ No tokens found across all chains'
        });
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
