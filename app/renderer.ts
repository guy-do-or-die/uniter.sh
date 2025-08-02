import '@xterm/xterm/css/xterm.css';

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { TerminalRenderer } from '../shared/terminal/types.js';
import { getSupportedChains, getNetworkIdentifier } from '../shared/chains.js';

/**
 * Web Terminal Renderer - implements TerminalRenderer for browser environment using xterm.js
 */
export class WebTerminalRenderer implements TerminalRenderer {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private inputCallback?: (input: string) => void;
  private exitCallback?: () => void;
  private currentInput: string = '';
  private inputStartCol: number = 0;
  private cursorPosition: number = 0;
  private commandHistory: string[] = [];
  private historyIndex: number = -1;
  private currentPrompt: string = '';
  private commands: string[] = ['help', 'connect', 'disconnect', 'status', 'scan', 'multichain', 'chains', 'clear', 'exit', 'quit', 'q'];
  private networkIds: string[] = [];
  private chainNames: string[] = [];

  constructor() {
    this.fitAddon = new FitAddon();
    
    // Calculate responsive font size based on screen width
    // Optimized for Farcaster miniapp environments
    const getResponsiveFontSize = (): number => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Detect Farcaster miniapp environment (typically smaller containers)
      const isMiniappEnvironment = width < 500 || height < 600;
      
      if (isMiniappEnvironment) {
        return 10;  // Compact fit for miniapp containers
      } else if (width <= 480) {
        return 10;  // Small phones
      } else if (width <= 768) {
        return 11;  // Larger phones/small tablets
      } else if (width <= 1024) {
        return 12; // Tablets
      }
      return 13; // Desktop
    };
    
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
      fontFamily: '"DejaVu Sans Mono", "Liberation Mono", "Consolas", "Menlo", "Monaco", "Cascadia Code", monospace',
      fontSize: getResponsiveFontSize(),
      lineHeight: 1.0,
      letterSpacing: -0.1,
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
      // Critical settings for block character rendering
      minimumContrastRatio: 1,
      overviewRulerWidth: 0,
      // Custom link handler to open links properly without security warnings
      linkHandler: {
        activate: (event: MouseEvent, uri: string) => {
          // Prevent the default terminal link behavior that causes security warnings
          event.preventDefault();
          event.stopPropagation();
          
          try {
            // Open link in new tab/window using window.open instead of direct navigation
            // This avoids the browser security warning dialog
            const newWindow = window.open(uri, '_blank', 'noopener,noreferrer');
            if (newWindow) {
              newWindow.focus();
              console.log('Terminal link opened in new tab:', uri);
            } else {
              // Fallback if popup blocked
              console.log('Link blocked by popup blocker:', uri);
              // Could show a user-friendly message here
            }
          } catch (error) {
            console.error('Failed to open link:', uri, error);
          }
          
          return false;
        },
        hover: () => {},
        leave: () => {}
      },
      // Force precise character positioning
      rescaleOverlappingGlyphs: true,
      customGlyphs: true,
      smoothScrollDuration: 0,
      // Fix scrolling behavior
      scrollOnUserInput: true,
      altClickMovesCursor: false,
      // Fixed width to preserve ANSI art logo
      cols: 120  // Keep original width for logo integrity
      // Don't set fixed rows - let it use available height
    });

    // Load fit addon for terminal sizing
    this.terminal.loadAddon(this.fitAddon);
    
    this.setupXtermHandlers();
    this.initializeAutoComplete();
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
    
    // Use fit addon for height calculation but maintain responsive width
    this.fitAddon.fit();
    // Override the width to maintain fixed columns for ANSI art
    this.terminal.resize(120, this.terminal.rows);
  
    // Auto-focus the terminal for immediate input
    this.terminal.focus();
    
    // Setup scrollbar visibility control
    this.setupScrollbarVisibilityControl(terminalElement);
    
    // Setup horizontal scrollbar auto-hide
    this.setupHorizontalScrollbarAutoHide(terminalElement);
  
    // Enhanced focus handling for mobile devices
    const focusTerminal = () => {
      this.terminal.focus();
      // Force focus on mobile by triggering textarea focus
      const textarea = terminalElement.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
      }
    };
    
    // Focus on click/touch with mobile support
    terminalElement.addEventListener('click', focusTerminal);
    terminalElement.addEventListener('touchstart', focusTerminal);
    
    // Ensure terminal stays focused on mobile
    document.addEventListener('touchend', (e) => {
      // If touch ended on terminal, refocus it
      if (terminalElement.contains(e.target as Node)) {
        setTimeout(focusTerminal, 100); // Small delay for mobile keyboards
      }
    });
    

    
    // Ensure F5 and other browser keys work at document level
    document.addEventListener('keydown', (event) => {
      if (event.code === 'F5' || 
          (event.ctrlKey && event.code === 'KeyR') || 
          (event.metaKey && event.code === 'KeyR')) {
        console.log('Document-level browser key detected:', event.code, 'allowing default behavior');
        // Don't prevent default - let browser handle reload
        return true;
      }
    }, { capture: true }); // Use capture to handle before terminal

    // Handle window resize
    window.addEventListener('resize', () => {
      this.updateFontSize();
      
      // Update font size and recalculate height while keeping responsive width
      this.fitAddon.fit();
      // Override width to maintain 120 columns for ANSI art
      this.terminal.resize(120, this.terminal.rows);
    });
  }

  /**
   * Calculate optimal column width based on viewport and environment
   */
  private getOptimalColumns(): number {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Detect Farcaster miniapp environment
    const isMiniappEnvironment = width < 500 || height < 600;
    
    if (isMiniappEnvironment) {
      // Smaller column count for miniapp containers
      return Math.max(60, Math.floor(width / 8)); // Minimum 60 cols, responsive to width
    } else if (width <= 480) {
      return 80;  // Small phones
    } else if (width <= 768) {
      return 100; // Larger phones/small tablets
    } else if (width <= 1024) {
      return 110; // Tablets
    }
    return 120; // Desktop - original width
  }

  /**
   * Update font size based on window width and height
   * Optimized for Farcaster miniapp environments
   */
  private updateFontSize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    let fontSize: number;
    
    // Detect Farcaster miniapp environment
    const isMiniappEnvironment = width < 500 || height < 600;
    
    if (isMiniappEnvironment) {
      fontSize = 10;  // Compact fit for miniapp containers
    } else if (width <= 480) {
      fontSize = 10;  // Small phones
    } else if (width <= 768) {
      fontSize = 11;  // Larger phones/small tablets
    } else if (width <= 1024) {
      fontSize = 12; // Tablets
    } else {
      fontSize = 13; // Desktop
    }
    
    this.terminal.options.fontSize = fontSize;
  }

  /**
   * Setup xterm.js-specific event handlers
   */
  private setupXtermHandlers(): void {
    // Handle keyboard input
    this.terminal.onKey(({ key, domEvent }) => {
      // Check for browser keys first - let them pass through completely
      if (this.isBrowserKey(domEvent)) {
        console.log('Browser key detected:', domEvent.code, 'letting browser handle it');
        return; // Don't interfere with browser keys at all
      }
      
      // Filter out other function keys and non-browser keys
      if (this.shouldIgnoreKey(domEvent)) {
        domEvent.preventDefault(); // Prevent other function keys
        return;
      }
      
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;
      
      // Enhanced Enter key detection for mobile virtual keyboards
      // Mobile keyboards may not set domEvent.code consistently
      const isEnterKey = domEvent.code === 'Enter' || 
                        domEvent.key === 'Enter' || 
                        domEvent.keyCode === 13 || 
                        domEvent.which === 13 ||
                        key === '\r' || 
                        key === '\n';
      
      if (isEnterKey) {
        domEvent.preventDefault(); // Prevent default mobile keyboard behavior
        this.handleEnter();
      } else if (domEvent.code === 'Backspace') {
        this.handleBackspace();
      } else if (domEvent.code === 'Delete') {
        this.handleDelete();
      } else if (domEvent.code === 'Tab') {
        domEvent.preventDefault();
        this.handleTabCompletion();
      } else if (domEvent.code === 'ArrowLeft') {
        this.handleArrowLeft();
      } else if (domEvent.code === 'ArrowRight') {
        this.handleArrowRight();
      } else if (domEvent.code === 'ArrowUp') {
        this.handleArrowUp();
      } else if (domEvent.code === 'ArrowDown') {
        this.handleArrowDown();
      } else if (domEvent.code === 'Home') {
        this.handleHome();
      } else if (domEvent.code === 'End') {
        this.handleEnd();
      } else if (domEvent.ctrlKey && domEvent.code === 'KeyA') {
        this.handleHome();
      } else if (domEvent.ctrlKey && domEvent.code === 'KeyE') {
        this.handleEnd();
      } else if (domEvent.ctrlKey && domEvent.code === 'KeyU') {
        this.handleClearLine();
      } else if (printable) {
        this.handlePrintableKey(key);
      }
    });
    
    // Prevent cursor from moving outside input area
    this.terminal.onData((data) => {
      // Block certain escape sequences that could move cursor
      if (data.includes('\x1b[') && (data.includes('A') || data.includes('B') || data.includes('C') || data.includes('D'))) {
        return; // Block arrow key sequences
      }
      
      // Block function key escape sequences (F1-F12)
      if (data.includes('\x1b[') && /\d+~/.test(data)) {
        return; // Block function key sequences like [15~ (F5)
      }
    });
  }
  
  /**
   * Check if a key should be ignored by the terminal
   */
  private shouldIgnoreKey(domEvent: KeyboardEvent): boolean {
    // Function keys (F1-F12)
    if (domEvent.code.startsWith('F') && /^F\d+$/.test(domEvent.code)) {
      return true;
    }
    
    // Browser-specific keys that should be handled by browser
    const browserKeys = [
      'F5', 'F12', // Refresh, DevTools
      'MetaLeft', 'MetaRight', // Cmd/Windows key
      'ContextMenu', // Right-click menu
      'PrintScreen', 'ScrollLock', 'Pause',
      'Insert', 'PageUp', 'PageDown'
    ];
    
    if (browserKeys.includes(domEvent.code)) {
      return true;
    }
    
    // Ctrl+R (refresh), Ctrl+Shift+I (DevTools), etc.
    if (domEvent.ctrlKey && ['KeyR', 'KeyI', 'KeyJ', 'KeyU'].includes(domEvent.code) && domEvent.shiftKey) {
      return true;
    }
    
    // Cmd+R on Mac
    if (domEvent.metaKey && domEvent.code === 'KeyR') {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if a key should be handled by the browser
   */
  private isBrowserKey(domEvent: KeyboardEvent): boolean {
    // Keys that should trigger browser actions
    const browserActionKeys = [
      'F5', 'F12', // Refresh, DevTools
    ];
    
    if (browserActionKeys.includes(domEvent.code)) {
      return true;
    }
    
    // Ctrl+R (refresh), Ctrl+Shift+I (DevTools), etc.
    if (domEvent.ctrlKey && ['KeyR'].includes(domEvent.code)) {
      return true;
    }
    
    // Cmd+R on Mac
    if (domEvent.metaKey && domEvent.code === 'KeyR') {
      return true;
    }
    
    return false;
  }

  /**
   * Handle Enter key press
   */
  private handleEnter(): void {
    this.terminal.writeln('');
    const trimmedInput = this.currentInput.trim();
    
    // Add to command history if not empty and not duplicate
    if (trimmedInput && (this.commandHistory.length === 0 || this.commandHistory[this.commandHistory.length - 1] !== trimmedInput)) {
      this.commandHistory.push(trimmedInput);
      // Keep history to reasonable size
      if (this.commandHistory.length > 100) {
        this.commandHistory.shift();
      }
    }
    
    if (this.inputCallback) {
      this.inputCallback(trimmedInput);
    }
    
    this.currentInput = '';
    this.cursorPosition = 0;
    this.historyIndex = -1;
  }

  /**
   * Handle Backspace key press
   */
  private handleBackspace(): void {
    if (this.cursorPosition > 0) {
      const before = this.currentInput.substring(0, this.cursorPosition - 1);
      const after = this.currentInput.substring(this.cursorPosition);
      this.currentInput = before + after;
      this.cursorPosition--;
      
      // Optimize for backspace at end of line (most common case)
      if (after.length === 0) {
        // Simple case: just move back and clear character
        this.terminal.write('\b \b');
      } else {
        // Complex case: need to redraw (when deleting from middle)
        this.redrawInput();
      }
    }
  }

  /**
   * Handle Delete key press
   */
  private handleDelete(): void {
    if (this.cursorPosition < this.currentInput.length) {
      const before = this.currentInput.substring(0, this.cursorPosition);
      const after = this.currentInput.substring(this.cursorPosition + 1);
      this.currentInput = before + after;
      
      // Optimize for delete at end of line
      if (this.cursorPosition === this.currentInput.length) {
        // Simple case: just clear the character at cursor and shift content
        this.terminal.write(' \b');
      } else {
        // Complex case: need to redraw (when deleting from middle)
        this.redrawInput();
      }
    }
  }

  /**
   * Initialize autocomplete data
   */
  private initializeAutoComplete(): void {
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
   * Setup scrollbar visibility control to hide vertical scrollbar during horizontal scrolling
   */
  private setupScrollbarVisibilityControl(terminalElement: HTMLElement): void {
    terminalElement.addEventListener('scroll', () => {
      const xtermViewport = terminalElement.querySelector('.xterm-viewport') as HTMLElement;
      if (!xtermViewport) return;
      
      // Hide vertical scrollbar when scrolling horizontally
      if (terminalElement.scrollLeft > 0) {
        xtermViewport.style.setProperty('overflow-y', 'hidden', 'important');
      } else {
        // Show vertical scrollbar immediately when back at left edge
        xtermViewport.style.setProperty('overflow-y', 'auto', 'important');
      }
    });
  }

  /**
   * Setup horizontal scrollbar auto-hide functionality
   * Enhanced for Farcaster miniapp environment
   */
  private setupHorizontalScrollbarAutoHide(terminalElement: HTMLElement): void {
    let scrollTimeout: NodeJS.Timeout;
    
    // Function to handle scroll events
    const handleScroll = () => {
      const scrollLeft = terminalElement.scrollLeft;
      
      // Show horizontal scrollbar when scrolling horizontally
      if (scrollLeft > 0) {
        terminalElement.classList.add('scrolling-horizontal');
        console.log('Horizontal scrollbar shown, scrollLeft:', scrollLeft);
      } else {
        terminalElement.classList.remove('scrolling-horizontal');
        console.log('Horizontal scrollbar hidden, scrollLeft:', scrollLeft);
      }
      
      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // Hide horizontal scrollbar after scrolling stops
      scrollTimeout = setTimeout(() => {
        if (terminalElement.scrollLeft === 0) {
          terminalElement.classList.remove('scrolling-horizontal');
          console.log('Horizontal scrollbar auto-hidden after timeout');
        }
      }, 1500); // Increased to 1.5 seconds for better UX
    };
    
    // Add scroll event listener
    terminalElement.addEventListener('scroll', handleScroll, { passive: true });
    
    // Also listen on the xterm viewport for better Farcaster compatibility
    const observer = new MutationObserver(() => {
      const xtermViewport = terminalElement.querySelector('.xterm-viewport');
      if (xtermViewport) {
        xtermViewport.addEventListener('scroll', handleScroll, { passive: true });
        observer.disconnect();
      }
    });
    
    observer.observe(terminalElement, { childList: true, subtree: true });
    
    // Initial check in case we're already scrolled
    setTimeout(() => {
      if (terminalElement.scrollLeft > 0) {
        terminalElement.classList.add('scrolling-horizontal');
      }
    }, 100);
  }

  /**
   * Handle Tab key press for tab completion
   */
  private handleTabCompletion(): void {
    const trimmed = this.currentInput.trim();
    const parts = trimmed.split(' ');
    
    if (parts.length === 1) {
      // Complete command names
      const hits = this.commands.filter(cmd => cmd.startsWith(parts[0]));
      if (hits.length === 1) {
        // Single match - complete it
        const completion = hits[0];
        this.currentInput = completion + ' ';
        this.cursorPosition = this.currentInput.length;
        this.redrawInput();
      } else if (hits.length > 1) {
        // Multiple matches - show them
        this.terminal.write('\r\n');
        this.terminal.writeln(hits.join('  '));
        // Redraw prompt and input properly
        this.terminal.write(this.currentPrompt);
        this.inputStartCol = this.getVisibleLength(this.currentPrompt);
        this.terminal.write(this.currentInput);
        this.cursorPosition = this.currentInput.length;
        // Ensure cursor is positioned correctly
        const targetCol = this.inputStartCol + this.cursorPosition + 1;
        this.terminal.write(`\x1b[${targetCol}G`);
      } else {
        // No matches - bell
        this.terminal.write('\x07');
      }
    } else if (parts.length === 2 && (parts[0] === 'scan' || parts[0] === 's')) {
      // Complete network identifiers for scan command
      const input = parts[1].toLowerCase();
      const networkHits = this.networkIds.filter(network => network.startsWith(input));
      const chainHits = this.chainNames.filter(chain => chain.startsWith(input));
      const allHits = [...new Set([...networkHits, ...chainHits])];
      
      if (allHits.length === 1) {
        // Single match - complete it
        const completion = allHits[0];
        this.currentInput = `${parts[0]} ${completion} `;
        this.cursorPosition = this.currentInput.length;
        this.redrawInput();
      } else if (allHits.length > 1) {
        // Multiple matches - show them
        this.terminal.write('\r\n');
        this.terminal.writeln(allHits.join('  '));
        // Redraw prompt and input properly
        this.terminal.write(this.currentPrompt);
        this.inputStartCol = this.getVisibleLength(this.currentPrompt);
        this.terminal.write(this.currentInput);
        this.cursorPosition = this.currentInput.length;
        // Ensure cursor is positioned correctly
        const targetCol = this.inputStartCol + this.cursorPosition + 1;
        this.terminal.write(`\x1b[${targetCol}G`);
      } else {
        // No matches - bell
        this.terminal.write('\x07');
      }
    } else {
      // No completion available - bell
      this.terminal.write('\x07');
    }
  }

  /**
   * Handle printable key press
   */
  private handlePrintableKey(key: string): void {
    // Insert character at cursor position
    const before = this.currentInput.substring(0, this.cursorPosition);
    const after = this.currentInput.substring(this.cursorPosition);
    this.currentInput = before + key + after;
    this.cursorPosition++;
    
    // If inserting in middle, redraw entire input
    if (after.length > 0) {
      this.redrawInput();
    } else {
      // Just append at end
      this.terminal.write(key);
    }
  }

  /**
   * Handle arrow key navigation
   */
  private handleArrowLeft(): void {
    if (this.cursorPosition > 0) {
      this.cursorPosition--;
      this.terminal.write('\x1b[D'); // Move cursor left
    }
  }
  
  private handleArrowRight(): void {
    if (this.cursorPosition < this.currentInput.length) {
      this.cursorPosition++;
      this.terminal.write('\x1b[C'); // Move cursor right
    }
  }
  
  private handleArrowUp(): void {
    if (this.commandHistory.length > 0) {
      if (this.historyIndex === -1) {
        this.historyIndex = this.commandHistory.length - 1;
      } else if (this.historyIndex > 0) {
        this.historyIndex--;
      }
      this.setInputFromHistory();
    }
  }
  
  private handleArrowDown(): void {
    if (this.historyIndex !== -1) {
      if (this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++;
        this.setInputFromHistory();
      } else {
        this.historyIndex = -1;
        this.currentInput = '';
        this.cursorPosition = 0;
        this.redrawInput();
      }
    }
  }
  
  private handleHome(): void {
    this.cursorPosition = 0;
    this.terminal.write(`\x1b[${this.inputStartCol + 1}G`); // Move to start of input
  }
  
  private handleEnd(): void {
    this.cursorPosition = this.currentInput.length;
    this.terminal.write(`\x1b[${this.inputStartCol + this.currentInput.length + 1}G`); // Move to end of input
  }
  
  private handleClearLine(): void {
    this.currentInput = '';
    this.cursorPosition = 0;
    this.redrawInput();
  }
  
  /**
   * Set input from command history
   */
  private setInputFromHistory(): void {
    if (this.historyIndex >= 0 && this.historyIndex < this.commandHistory.length) {
      this.currentInput = this.commandHistory[this.historyIndex];
      this.cursorPosition = this.currentInput.length;
      this.redrawInput();
    }
  }
  
  /**
   * Redraw the current input line
   */
  private redrawInput(): void {
    // Save current cursor position
    const targetCol = this.inputStartCol + this.cursorPosition + 1;
    
    // Move to start of input area
    this.terminal.write(`\x1b[${this.inputStartCol + 1}G`);
    // Clear from input start to end of line
    this.terminal.write('\x1b[K');
    // Write the current input
    this.terminal.write(this.currentInput);
    // Position cursor correctly
    this.terminal.write(`\x1b[${targetCol}G`);
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
    // Clear current line and move to next (consistent with CLI)
    this.terminal.write('\r\x1b[K');
  }

  // Input/prompt methods
  showPrompt(prompt: string): void {
    this.currentPrompt = prompt;
    this.terminal.write(prompt);
    // Calculate input start column by counting visible characters (excluding ANSI codes)
    this.inputStartCol = this.getVisibleLength(prompt);
    this.currentInput = '';
    this.cursorPosition = 0;
    this.historyIndex = -1;
  }
  
  /**
   * Get visible length of string excluding ANSI escape codes
   */
  private getVisibleLength(str: string): number {
    // Remove ANSI escape sequences to get actual visible length
    return str.replace(/\x1b\[[0-9;]*m/g, '').length;
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
