#!/usr/bin/env node

import readline from 'readline';
import chalk from 'chalk';
import { TerminalRenderer } from '../core/terminal/types.js';
import { getSupportedChains, getNetworkIdentifier } from '../core/chains.js';

/**
 * CLI Terminal Renderer - implements TerminalRenderer for Node.js CLI environment
 */
export class CliTerminalRenderer implements TerminalRenderer {
  private rl: readline.Interface;
  private commands: string[] = ['help', 'connect', 'disconnect', 'status', 'scan', 'multichain', 'chains', 'clear', 'exit', 'quit', 'q'];
  private networkIds: string[] = [];
  private chainNames: string[] = [];
  private inputCallback?: (input: string) => void;
  private exitCallback?: () => void;
  private currentInput: string = '';
  private isExiting: boolean = false;
  private ctrlCPressed: boolean = false;

  constructor() {
    // Initialize network identifiers first
    this.initializeNetworkIds();
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '',
      completer: this.completer.bind(this)
    });

    this.setupReadlineHandlers();
  }

  /**
   * Initialize network identifiers and chain names for autocomplete
   */
  private initializeNetworkIds(): void {
    try {
      const chains = getSupportedChains();
      this.networkIds = chains.map((chain: { id: number; name: string }) => getNetworkIdentifier(chain.id));
      this.chainNames = chains.map((chain: { id: number; name: string }) => chain.name.toLowerCase());
    } catch (error) {
      // Fallback if chains not available
      this.networkIds = ['arbitrum', 'avalanche', 'base', 'bnb', 'gnosis', 'linea', 'ethereum', 'optimism', 'polygon', 'sonic', 'unichain', 'zksync'];
      this.chainNames = ['arbitrum one', 'avalanche', 'base', 'bnb smart chain', 'gnosis', 'linea mainnet', 'ethereum', 'op mainnet', 'polygon', 'sonic', 'unichain', 'zksync era'];
    }
  }

  /**
   * Tab completion function
   */
  private completer(line: string): [string[], string] {
    const trimmed = line.trim();
    const parts = trimmed.split(' ');
    
    if (parts.length === 1) {
      // Complete command names
      const hits = this.commands.filter(cmd => cmd.startsWith(parts[0]));
      return [hits, parts[0]];
    } else if (parts.length === 2 && (parts[0] === 'scan' || parts[0] === 's')) {
      // Complete both network identifiers and full chain names for scan command
      const input = parts[1].toLowerCase();
      const networkHits = this.networkIds.filter(network => network.startsWith(input));
      const chainHits = this.chainNames.filter(chain => chain.startsWith(input));
      const allHits = [...new Set([...networkHits, ...chainHits])];
      return [allHits, parts[1]];
    }
    
    // No completion available
    return [[], line];
  }

  /**
   * Setup readline-specific event handlers
   */
  private setupReadlineHandlers(): void {
    this.rl.on('line', (input: string) => {
      if (this.inputCallback && !this.isExiting) {
        this.inputCallback(input);
      }
    });

    // Handle Ctrl+D (EOF) - treat as exit command
    this.rl.on('close', () => {
      if (!this.isExiting) {
        this.isExiting = true;
        console.log(chalk.blue('\n👋 Thanks for using uniter.sh!'));
        process.exit(0);
      }
    });

    // Handle Ctrl+C gracefully
    this.rl.on('SIGINT', () => {
      if (this.isExiting || this.ctrlCPressed) {
        // Second Ctrl+C or already exiting - force quit
        console.log(chalk.blue('\n👋 Thanks for using uniter.sh!'));
        process.exit(0);
      }
      // First Ctrl+C - show message and set flag
      this.ctrlCPressed = true;
      console.log(chalk.yellow('\n💡 Use "exit" to quit or Ctrl+C again to force quit'));
      this.showPrompt(this.rl.getPrompt());
      
      // Reset the flag after 3 seconds so user doesn't accidentally quit later
      setTimeout(() => {
        this.ctrlCPressed = false;
      }, 3000);
    });
  }

  // Core rendering methods
  write(content: string): void {
    process.stdout.write(content);
  }

  writeln(content: string): void {
    console.log(content);
  }

  clear(): void {
    console.clear();
  }

  // Styled output methods using chalk
  writeSuccess(content: string): void {
    console.log(chalk.green(content));
  }

  writeError(content: string): void {
    console.log(chalk.red(content));
  }

  writeWarning(content: string): void {
    console.log(chalk.yellow(content));
  }

  writeInfo(content: string): void {
    console.log(chalk.blue(content));
  }

  writeBanner(content: string): void {
    console.log(chalk.bold.cyan(content));
  }

  // Progress update methods
  updateProgress(content: string): void {
    // Clear current line and write progress
    process.stdout.write('\r\x1b[K'); // Clear line
    process.stdout.write(chalk.yellow(content));
  }

  clearProgress(): void {
    // Clear current line (compact display, no extra spacing)
    process.stdout.write('\r\x1b[K');
  }

  // Input/prompt methods
  showPrompt(prompt: string): void {
    this.rl.setPrompt(prompt);
    this.rl.prompt();
  }

  getCurrentInput(): string {
    return this.currentInput;
  }

  clearCurrentInput(): void {
    this.currentInput = '';
  }

  // Event handling
  onInput(callback: (input: string) => void): void {
    this.inputCallback = callback;
  }

  onExit(callback: () => void): void {
    this.exitCallback = callback;
  }

  /**
   * Initialize the CLI terminal renderer
   */
  async init(): Promise<void> {
    // CLI terminal is ready immediately
    return Promise.resolve();
  }

  /**
   * Clean up the readline interface
   */
  cleanup(): void {
    this.isExiting = true;
    this.rl.close();
  }
}
