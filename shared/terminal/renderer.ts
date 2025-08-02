/**
 * Unified Terminal Renderer - Common terminal logic for CLI and Web environments
 * Uses dependency injection for environment-specific rendering
 */

import { UnifiedTerminalEngine } from './engine.js';
import type { TerminalOutput, TerminalRenderer } from './types.js';

/**
 * Unified Terminal Renderer - handles common terminal logic
 */
export class UnifiedTerminalRenderer {
  private engine: UnifiedTerminalEngine;
  private renderer: TerminalRenderer;
  private currentInput: string = '';
  private isExiting: boolean = false;

  constructor(engine: UnifiedTerminalEngine, renderer: TerminalRenderer) {
    this.engine = engine;
    this.renderer = renderer;
    // Set renderer reference in engine for progress updates
    this.engine.setRenderer(renderer);
    this.setupEventHandlers();
  }

  /**
   * Setup common event handlers
   */
  private setupEventHandlers(): void {
    this.renderer.onInput(async (input: string) => {
      await this.handleCommand(input);
    });

    this.renderer.onExit(() => {
      this.handleExit();
    });
  }

  /**
   * Initialize and start the terminal
   */
  async start(): Promise<void> {
    // Try to restore existing session (for web environment)
    const env = this.engine.getEnvironment();
    if (env.isBrowser && env.canConnectWallet) {
      try {
        await this.engine.restoreSession();
      } catch (error) {
        // Ignore restore errors - user can manually connect
        console.log('Session restore failed (this is normal):', error);
      }
    }
    
    // Clear screen and show startup
    //this.renderer.clear();
    await this.showStartup();
    await this.showPrompt();
  }

  /**
   * Show startup banner and status
   */
  private async showStartup(): Promise<void> {
    // Add some spacing before banner if there was debug output
    this.renderer.writeln('');
    
    const startupOutputs = this.engine.getStartupBanner();
    this.renderOutputs(startupOutputs);
    
    // Add spacing after banner
    this.renderer.writeln('');
    
    // Try to restore session on startup
    try {
      const statusOutputs = await this.engine.executeCommand('status');
      this.renderOutputs(statusOutputs);
    } catch (error) {
      // Ignore startup status errors
    }
  }

  /**
   * Show command prompt
   */
  private async showPrompt(): Promise<void> {
    const prompt = await this.engine.getPrompt();
    this.renderer.showPrompt(prompt);
  }

  /**
   * Handle command execution
   */
  private async handleCommand(input: string): Promise<void> {
    const trimmedInput = input.trim();
    
    if (!trimmedInput) {
      await this.showPrompt();
      return;
    }

    // Check if exit command BEFORE executing it
    if (this.isExitCommand(trimmedInput)) {
      if (!this.isExiting) {
        this.handleExit();
      }
      return;
    }

    try {
      const outputs = await this.engine.executeCommand(trimmedInput);
      this.renderOutputs(outputs);
      

    } catch (error) {
      this.renderer.writeError(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Add spacing after command output
    this.renderer.writeln('');
    await this.showPrompt();
  }

  /**
   * Check if command is an exit command
   */
  private isExitCommand(input: string): boolean {
    const exitCommands = ['exit', 'quit', 'q'];
    return exitCommands.includes(input.toLowerCase());
  }

  /**
   * Handle terminal exit
   */
  private handleExit(): void {
    if (this.isExiting) {
      return; // Already exiting, prevent multiple calls
    }
    this.isExiting = true;
    this.renderer.writeln('');
    this.renderer.writeInfo('👋 Thanks for using uniter.sh!');
    
    // For CLI environment, force process exit immediately
    if (typeof process !== 'undefined' && process.exit) {
      // Trigger cleanup and exit
      if (typeof this.renderer.cleanup === 'function') {
        this.renderer.cleanup();
      }
      process.exit(0);
    } else {
      // For web environment, reset terminal state instead of exiting
      this.renderer.writeln('');
      this.renderer.writeInfo('Type "connect" to start a new session.');
      this.renderer.writeln('');
      
      // Reset session state
      this.isExiting = false;
      this.engine.resetSession();
      
      // Show fresh prompt
      setTimeout(async () => {
        const prompt = await this.engine.getPrompt();
        this.renderer.showPrompt(prompt);
      }, 100);
    }
  }

  /**
   * Render multiple terminal outputs
   */
  private renderOutputs(outputs: TerminalOutput[]): void {
    outputs.forEach(output => {
      this.renderOutput(output);
    });
  }

  /**
   * Render a single terminal output using environment-specific renderer
   */
  private renderOutput(output: TerminalOutput): void {
    const content = output.content;
    
    switch (output.type) {
      case 'banner':
        this.renderer.writeBanner(content);
        break;
      case 'success':
        this.renderer.writeSuccess(content);
        break;
      case 'error':
        this.renderer.writeError(content);
        break;
      case 'warning':
        this.renderer.writeWarning(content);
        break;
      case 'info':
        this.renderer.writeInfo(content);
        break;
      case 'table':
        // For future table rendering
        this.renderer.write(content);
        break;
      case 'text':
      default:
        this.renderer.write(content);
        break;
    }
    
    // Add newline if content doesn't end with one
    if (!content.endsWith('\n')) {
      this.renderer.writeln('');
    }
  }

  /**
   * Get autocomplete suggestions
   */
  getAutocompleteSuggestions(input: string): string[] {
    return this.engine.getAutocompleteSuggestions(input);
  }

  /**
   * Complete input with suggestion
   */
  completeInput(input: string): string {
    return this.engine.completeInput(input);
  }
}
