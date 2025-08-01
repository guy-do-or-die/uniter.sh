#!/usr/bin/env node

import readline from 'readline';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { UnifiedTerminalEngine, TerminalOutput } from '../shared/engine.js';

// Load environment variables
dotenv.config();

/**
 * CLI Terminal Renderer - renders terminal output for native CLI
 */
export class CliTerminalRenderer {
  private rl: readline.Interface;
  private engine: UnifiedTerminalEngine;

  constructor(engine: UnifiedTerminalEngine) {
    this.engine = engine;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.engine.getPrompt()
    });

    this.setupEventHandlers();
  }

  /**
   * Setup readline event handlers
   */
  private setupEventHandlers(): void {
    this.rl.on('line', async (input: string) => {
      const trimmedInput = input.trim();
      
      if (trimmedInput) {
        const outputs = await this.engine.executeCommand(trimmedInput);
        this.renderOutputs(outputs);
        
        // Check if exit command was executed
        if (trimmedInput.toLowerCase() === 'exit' || 
            trimmedInput.toLowerCase() === 'quit' || 
            trimmedInput.toLowerCase() === 'q') {
          this.rl.close();
          process.exit(0);
        }
      }
      
      // Update prompt in case wallet status changed
      this.rl.setPrompt(this.engine.getPrompt());
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log(chalk.cyan('\n👋 Goodbye!'));
      process.exit(0);
    });

    // Handle Ctrl+C gracefully
    this.rl.on('SIGINT', () => {
      console.log(chalk.yellow('\n💡 Use "exit" to quit or Ctrl+C again to force quit'));
      this.rl.prompt();
    });
  }

  /**
   * Render terminal outputs with appropriate styling
   */
  private renderOutputs(outputs: TerminalOutput[]): void {
    outputs.forEach(output => {
      this.renderOutput(output);
    });
  }

  /**
   * Render a single terminal output
   */
  private renderOutput(output: TerminalOutput): void {
    switch (output.type) {
      case 'banner':
        console.log(chalk.cyan.bold(output.content));
        break;
      case 'success':
        console.log(chalk.green(output.content));
        break;
      case 'error':
        console.log(chalk.red(output.content));
        break;
      case 'warning':
        console.log(chalk.yellow(output.content));
        break;
      case 'info':
        console.log(chalk.blue(output.content));
        break;
      case 'table':
        // For future table rendering
        console.log(output.content);
        break;
      case 'text':
      default:
        console.log(output.content);
        break;
    }
  }

  /**
   * Start the interactive terminal
   */
  async start(): Promise<void> {
    // Clear screen and show startup banner
    console.clear();
    
    const startupOutputs = this.engine.getStartupBanner();
    this.renderOutputs(startupOutputs);
    
    console.log(chalk.gray('\n💡 Pro tip: Use Tab for command completion (coming soon)'));
    console.log(chalk.gray('🔗 Start with "connect" to connect your wallet\n'));
    
    // Try to restore session on startup
    try {
      const statusOutputs = await this.engine.executeCommand('status');
      this.renderOutputs(statusOutputs);
    } catch (error) {
      // Ignore startup status errors
    }
    
    console.log(); // Empty line before first prompt
    this.rl.prompt();
  }
}


