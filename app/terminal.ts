import '@xterm/xterm/css/xterm.css';

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { UnifiedTerminalEngine, TerminalOutput } from '../shared/engine.js';
import { WebAdapter } from './web-adapter.js';

/**
 * Web Terminal Renderer - renders terminal output for web browsers using xterm.js
 */
export class WebTerminalRenderer {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private engine: UnifiedTerminalEngine;
  private currentInput: string = '';
  private inputStartCol: number = 0;

  constructor() {
    const adapter = new WebAdapter();
    this.engine = new UnifiedTerminalEngine(adapter);
    this.fitAddon = new FitAddon();
    
    // Create xterm terminal with professional dark theme
    this.terminal = new Terminal({
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#7ee787',
        yellow: '#f2cc60',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#c9d1d9',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc'
      },
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", "SF Mono", Monaco, "Inconsolata", "Roboto Mono", "Source Code Pro", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      tabStopWidth: 4,
    });

    this.terminal.loadAddon(this.fitAddon);
    this.setupEventHandlers();
  }

  /**
   * Initialize the web terminal
   */
  async init(): Promise<void> {
    const terminalElement = document.getElementById('terminal');
    if (!terminalElement) {
      throw new Error('Terminal element not found');
    }

    // Clear loading message
    terminalElement.innerHTML = '';
    
    // Open terminal
    this.terminal.open(terminalElement);
    this.fitAddon.fit();

    // Handle window resize
    window.addEventListener('resize', () => {
      this.fitAddon.fit();
    });

    // Show startup banner
    await this.showStartup();
    
    // Show initial prompt
    this.showPrompt();
  }

  /**
   * Setup terminal event handlers
   */
  private setupEventHandlers(): void {
    // Handle keyboard input
    this.terminal.onKey(({ key, domEvent }) => {
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;
      
      if (domEvent.code === 'Enter') {
        this.handleEnter();
      } else if (domEvent.code === 'Backspace') {
        this.handleBackspace();
      } else if (domEvent.code === 'Tab') {
        domEvent.preventDefault();
        this.handleTabCompletion();
      } else if (printable) {
        this.handlePrintableKey(key);
      }
    });
  }

  /**
   * Handle Enter key press
   */
  private handleEnter(): void {
    this.terminal.writeln('');
    if (this.currentInput.trim()) {
      this.executeCommand(this.currentInput.trim());
    }
    this.currentInput = '';
    this.showPrompt();
  }

  /**
   * Handle Backspace key press
   */
  private handleBackspace(): void {
    if (this.currentInput.length > 0) {
      this.currentInput = this.currentInput.slice(0, -1);
      this.terminal.write('\b \b');
    }
  }

  /**
   * Handle Tab key press for tab completion
   */
  private handleTabCompletion(): void {
    const suggestions = this.engine.getAutocompleteSuggestions(this.currentInput);
    
    if (suggestions.length === 0) {
      // No suggestions, just beep
      this.terminal.write('\x07'); // Bell character
      return;
    }
    
    if (suggestions.length === 1) {
      // Single suggestion, complete it
      const completed = this.engine.completeInput(this.currentInput);
      if (completed !== this.currentInput) {
        this.clearCurrentInput();
        this.currentInput = completed;
        this.terminal.write(completed);
      }
    } else {
      // Multiple suggestions, show them
      this.terminal.writeln('');
      this.terminal.writeln('Available commands:');
      suggestions.forEach(suggestion => {
        this.terminal.writeln(`  ${suggestion}`);
      });
      this.showPrompt();
      this.terminal.write(this.currentInput);
    }
  }

  /**
   * Handle printable key press
   */
  private handlePrintableKey(key: string): void {
    this.currentInput += key;
    this.terminal.write(key);
  }

  /**
   * Clear the current input from the terminal
   */
  private clearCurrentInput(): void {
    // Move cursor back to start of input and clear to end of line
    for (let i = 0; i < this.currentInput.length; i++) {
      this.terminal.write('\b');
    }
    this.terminal.write('\x1b[K'); // Clear to end of line
  }

  /**
   * Show startup banner and status
   */
  private async showStartup(): Promise<void> {
    const startupOutputs = this.engine.getStartupBanner();
    this.renderOutputs(startupOutputs);
    
    this.terminal.writeln('');
    this.terminal.write('💡 Pro tip: Type commands just like in the CLI terminal');
    this.terminal.writeln('');
    this.terminal.write('🔗 Start with "connect" to connect your wallet');
    this.terminal.writeln('');
    
    // Try to restore session on startup
    try {
      const statusOutputs = await this.engine.executeCommand('status');
      this.renderOutputs(statusOutputs);
    } catch (error) {
      // Ignore startup status errors
    }
    
    this.terminal.writeln('');
  }

  /**
   * Show command prompt
   */
  private showPrompt(): void {
    const prompt = this.engine.getPrompt();
    this.terminal.write(prompt);
    this.inputStartCol = prompt.length;
  }

  /**
   * Execute a command using the terminal engine
   */
  private async executeCommand(input: string): Promise<void> {
    try {
      const outputs = await this.engine.executeCommand(input);
      this.renderOutputs(outputs);
      
      // Check if exit command was executed
      if (input.toLowerCase() === 'exit' || 
          input.toLowerCase() === 'quit' || 
          input.toLowerCase() === 'q') {
        this.terminal.writeln('');
        this.terminal.write('👋 Thanks for using uniter.sh!');
        this.terminal.writeln('');
        this.terminal.write('💡 Refresh the page to restart the terminal');
        return;
      }
    } catch (error) {
      this.terminal.writeln('');
      this.terminal.write(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    this.terminal.writeln('');
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
   * Render a single terminal output with xterm.js styling
   */
  private renderOutput(output: TerminalOutput): void {
    const content = output.content;
    
    switch (output.type) {
      case 'banner':
        this.terminal.write(`\x1b[1;36m${content}\x1b[0m`); // Bold cyan
        break;
      case 'success':
        this.terminal.write(`\x1b[32m${content}\x1b[0m`); // Green
        break;
      case 'error':
        this.terminal.write(`\x1b[31m${content}\x1b[0m`); // Red
        break;
      case 'warning':
        this.terminal.write(`\x1b[33m${content}\x1b[0m`); // Yellow
        break;
      case 'info':
        this.terminal.write(`\x1b[34m${content}\x1b[0m`); // Blue
        break;
      case 'table':
        // For future table rendering
        this.terminal.write(content);
        break;
      case 'text':
      default:
        this.terminal.write(content);
        break;
    }
    
    // Add newline if content doesn't end with one
    if (!content.endsWith('\n')) {
      this.terminal.writeln('');
    }
  }
}
