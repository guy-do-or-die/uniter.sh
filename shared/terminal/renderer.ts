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

  constructor(engine: UnifiedTerminalEngine, renderer: TerminalRenderer) {
    this.engine = engine;
    this.renderer = renderer;
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
    // Clear screen and show startup
    this.renderer.clear();
    await this.showStartup();
    this.showPrompt();
  }

  /**
   * Show startup banner and status
   */
  private async showStartup(): Promise<void> {
    const startupOutputs = this.engine.getStartupBanner();
    this.renderOutputs(startupOutputs);
    
    // Add spacing after banner
    this.renderer.writeln('');
    
    this.renderer.writeInfo('💡 Pro tip: Use Tab for command completion (coming soon)');
    this.renderer.writeInfo('🔗 Start with "connect" to connect your wallet');
    
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
  private showPrompt(): void {
    const prompt = this.engine.getPrompt();
    this.renderer.showPrompt(prompt);
  }

  /**
   * Handle command execution
   */
  private async handleCommand(input: string): Promise<void> {
    const trimmedInput = input.trim();
    
    if (!trimmedInput) {
      this.showPrompt();
      return;
    }

    try {
      const outputs = await this.engine.executeCommand(trimmedInput);
      this.renderOutputs(outputs);
      
      // Check if exit command was executed
      if (this.isExitCommand(trimmedInput)) {
        this.handleExit();
        return;
      }
    } catch (error) {
      this.renderer.writeError(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Add spacing after command output
    this.renderer.writeln('');
    this.showPrompt();
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
    this.renderer.writeln('');
    this.renderer.writeInfo('👋 Thanks for using uniter.sh!');
    // Environment-specific exit handling will be done by the renderer
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
