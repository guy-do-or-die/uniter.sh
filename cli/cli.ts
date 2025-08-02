#!/usr/bin/env node

import { UnifiedTerminalEngine } from '../core/terminal/index.js';
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

  // Set renderer for interactive features
  engine.setRenderer(renderer.getRenderer());

  // Display startup logo
  const logoOutput = engine.displayStartupLogo();
  logoOutput.forEach(output => {
    if (output.type === 'info') {
      console.log(chalk.cyan(output.content));
    }
  });

  // Try to restore previous session
  console.log(chalk.yellow('🔄 Attempting to restore previous session...'));
  const restoredSession = await restoreSession();
  if (restoredSession) {
    console.log(chalk.green(`✅ Session restored: ${restoredSession.address} on chain ${restoredSession.chainId}`));
  } else {
    console.log(chalk.gray('ℹ️ No previous session found or session invalid'));
  }

  // Start the terminal
  await renderer.start();
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error instanceof Error ? error.message : String(error));
  process.exit(1);
});
