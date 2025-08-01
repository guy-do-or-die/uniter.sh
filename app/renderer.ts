import '@xterm/xterm/css/xterm.css';

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { CanvasAddon } from '@xterm/addon-canvas';
import { WebglAddon } from '@xterm/addon-webgl';
import { TerminalRenderer } from '../shared/terminal/types.js';

/**
 * Web Terminal Renderer - implements TerminalRenderer for browser environment using xterm.js
 */
export class WebTerminalRenderer implements TerminalRenderer {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private canvasAddon: CanvasAddon;
  private webglAddon: WebglAddon;
  private inputCallback?: (input: string) => void;
  private exitCallback?: () => void;
  private currentInput: string = '';
  private inputStartCol: number = 0;

  constructor() {
    this.fitAddon = new FitAddon();
    this.canvasAddon = new CanvasAddon();
    this.webglAddon = new WebglAddon();
    
    // Create xterm terminal with professional dark theme and enhanced ANSI support
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
      fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", "SF Mono", Monaco, "Inconsolata", "Roboto Mono", "Source Code Pro", monospace',
      fontSize: 13,
      lineHeight: 1.0,
      letterSpacing: -0.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      tabStopWidth: 4,
      allowProposedApi: true,
      allowTransparency: false,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      windowsMode: false,
      convertEol: false,
      screenReaderMode: false,
      disableStdin: false,
      logLevel: 'warn',
      // Additional settings for better ANSI art rendering
      drawBoldTextInBrightColors: false,
      fastScrollModifier: 'alt',
      fastScrollSensitivity: 5,
      scrollSensitivity: 1,
      smoothScrollDuration: 0,
    });

    // Load addons for enhanced rendering - try WebGL first, fallback to Canvas
    this.terminal.loadAddon(this.fitAddon);
    
    try {
      // Try WebGL first for best performance and accuracy
      this.terminal.loadAddon(this.webglAddon);
      
      // Handle WebGL context loss
      this.webglAddon.onContextLoss(() => {
        console.warn('WebGL context lost, falling back to Canvas renderer');
        this.webglAddon.dispose();
        this.terminal.loadAddon(this.canvasAddon);
      });
    } catch (error) {
      console.warn('WebGL not supported, using Canvas renderer:', error);
      this.terminal.loadAddon(this.canvasAddon);
    }
    
    this.setupXtermHandlers();
  }

  /**
   * Initialize the terminal in the DOM
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
  }

  /**
   * Setup xterm.js-specific event handlers
   */
  private setupXtermHandlers(): void {
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
    if (this.inputCallback) {
      this.inputCallback(this.currentInput.trim());
    }
    this.currentInput = '';
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
    // Tab completion will be handled by the unified renderer
    this.terminal.write('\x07'); // Bell character for now
  }

  /**
   * Handle printable key press
   */
  private handlePrintableKey(key: string): void {
    this.currentInput += key;
    this.terminal.write(key);
  }

  // Core rendering methods
  write(content: string): void {
    this.terminal.write(content);
  }

  writeln(content: string): void {
    this.terminal.writeln(content);
  }

  clear(): void {
    this.terminal.clear();
  }

  // Styled output methods using ANSI escape codes
  writeSuccess(content: string): void {
    this.terminal.writeln(`\x1b[32m${content}\x1b[0m`); // Green
  }

  writeError(content: string): void {
    this.terminal.writeln(`\x1b[31m${content}\x1b[0m`); // Red
  }

  writeWarning(content: string): void {
    this.terminal.writeln(`\x1b[33m${content}\x1b[0m`); // Yellow
  }

  writeInfo(content: string): void {
    this.terminal.writeln(`\x1b[34m${content}\x1b[0m`); // Blue
  }

  writeBanner(content: string): void {
    this.terminal.writeln(`\x1b[1;36m${content}\x1b[0m`); // Bold cyan
  }

  // Progress update methods
  updateProgress(content: string): void {
    // Clear current line and write progress
    this.terminal.write('\r\x1b[K'); // Clear line
    this.terminal.write(`\x1b[33m${content}\x1b[0m`); // Yellow progress text
  }

  clearProgress(): void {
    // Clear current line
    this.terminal.write('\r\x1b[K');
  }

  // Input/prompt methods
  showPrompt(prompt: string): void {
    this.terminal.write(prompt);
    this.inputStartCol = prompt.length;
  }

  getCurrentInput(): string {
    return this.currentInput;
  }

  clearCurrentInput(): void {
    // Move cursor back to start of input and clear to end of line
    for (let i = 0; i < this.currentInput.length; i++) {
      this.terminal.write('\b');
    }
    this.terminal.write('\x1b[K'); // Clear to end of line
    this.currentInput = '';
  }

  // Event handling
  onInput(callback: (input: string) => void): void {
    this.inputCallback = callback;
  }

  onExit(callback: () => void): void {
    this.exitCallback = callback;
  }

  // Lifecycle
  cleanup(): void {
    // Clean up xterm.js terminal
    this.terminal.dispose();
  }
}
