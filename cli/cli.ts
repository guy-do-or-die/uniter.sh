#!/usr/bin/env node

import { UnifiedTerminalEngine } from '../shared/terminal/index.js';
import { CliAdapter } from './adapter.js';
import { CliTerminalRenderer } from './terminal.js';
import { restoreSession } from './wallet.js';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Main CLI entry point
 */
async function main() {
  const adapter = new CliAdapter();
  const engine = new UnifiedTerminalEngine(adapter);
  const renderer = new CliTerminalRenderer(engine);

  // Try to restore previous session
  await restoreSession();

  // Start the terminal
  await renderer.start();
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error instanceof Error ? error.message : String(error));
  process.exit(1);
});
