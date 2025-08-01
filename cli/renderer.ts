#!/usr/bin/env node

import readline from 'readline';
import chalk from 'chalk';
import { TerminalRenderer } from '../shared/terminal/types.js';

/**
 * CLI Terminal Renderer - implements TerminalRenderer for Node.js CLI environment
 */
export class CliTerminalRenderer implements TerminalRenderer {
  private rl: readline.Interface;
  private inputCallback?: (input: string) => void;
  private exitCallback?: () => void;
  private currentInput: string = '';

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: ''
    });

    this.setupReadlineHandlers();
  }

  /**
   * Setup readline-specific event handlers
   */
  private setupReadlineHandlers(): void {
    this.rl.on('line', (input: string) => {
      if (this.inputCallback) {
        this.inputCallback(input);
      }
    });

    this.rl.on('close', () => {
      if (this.exitCallback) {
        this.exitCallback();
      }
      process.exit(0);
    });

    // Handle Ctrl+C gracefully
    this.rl.on('SIGINT', () => {
      console.log(chalk.yellow('\n💡 Use "exit" to quit or Ctrl+C again to force quit'));
      this.rl.prompt();
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
    // Clear current line and move to next
    process.stdout.write('\r\x1b[K\n');
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
    this.rl.close();
  }
}
