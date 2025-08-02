#!/usr/bin/env node

import dotenv from 'dotenv';
import { UnifiedTerminalEngine, UnifiedTerminalRenderer } from '../core/terminal/index.js';
import { CliTerminalRenderer as CliRenderer } from './renderer.js';

// Load environment variables
dotenv.config();

/**
 * CLI Terminal - unified terminal using dependency injection
 */
export class CliTerminalRenderer {
  private unifiedRenderer: UnifiedTerminalRenderer;
  private cliRenderer: CliRenderer;

  constructor(engine: UnifiedTerminalEngine) {
    this.cliRenderer = new CliRenderer();
    this.unifiedRenderer = new UnifiedTerminalRenderer(engine, this.cliRenderer);
  }

  /**
   * Start the interactive terminal using unified renderer
   */
  async start(): Promise<void> {
    await this.unifiedRenderer.start();
  }

  /**
   * Get the underlying renderer that implements TerminalRenderer interface
   */
  getRenderer(): CliRenderer {
    return this.cliRenderer;
  }

  /**
   * Close the terminal
   */
  close(): void {
    this.cliRenderer.cleanup();
  }
}


