#!/usr/bin/env node

import { defineCommand, runMain } from 'citty';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const main = defineCommand({
  meta: {
    name: 'uniter.sh',
    version: '1.0.0',
    description: '🔀 Unite all your onchain dust and scattered assets into a single token',
  },
  args: {
    help: {
      type: 'boolean',
      description: 'Show help',
      alias: 'h',
    },
  },
  async run({ args }) {
    if (args.help) {
      console.log(chalk.cyan('🔀 uniter.sh - Unite your scattered tokens'));
      console.log(chalk.gray('Available commands will be added incrementally...'));
      return;
    }
    
    console.log(chalk.cyan('🔀 Welcome to uniter.sh!'));
    console.log(chalk.gray('Use --help to see available options'));
  },
});

runMain(main);
