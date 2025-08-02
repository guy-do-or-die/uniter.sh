import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { UniterConfig, DEFAULT_CONFIG } from '../core/config.js';

const CONFIG_FILE = join(homedir(), '.uniterrc');

/**
 * Load configuration from .uniterrc file and environment variables
 */
export function loadConfig(): UniterConfig {
  let fileConfig: Partial<UniterConfig> = {};
  
  // Try to load from .uniterrc file
  if (existsSync(CONFIG_FILE)) {
    try {
      const configContent = readFileSync(CONFIG_FILE, 'utf-8');
      fileConfig = JSON.parse(configContent);
    } catch (error) {
      console.warn('Warning: Could not parse .uniterrc file, using defaults');
    }
  }
  
  // Merge with environment variables and defaults
  const config: UniterConfig = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    // Environment variables take precedence
    ...((process.env.ONEINCH_API_KEY || process.env.ONEINCH_API_KEY) && { 
      oneinchApiKey: process.env.ONEINCH_API_KEY || process.env.ONEINCH_API_KEY 
    }),
    // Support both old WALLETCONNECT_PROJECT_ID and new REOWN_PROJECT_ID (with and without VITE_ prefix)
    ...((process.env.VITE_REOWN_PROJECT_ID || process.env.VITE_WALLETCONNECT_PROJECT_ID || process.env.REOWN_PROJECT_ID || process.env.WALLETCONNECT_PROJECT_ID) && { 
      walletConnectProjectId: process.env.VITE_REOWN_PROJECT_ID || process.env.VITE_WALLETCONNECT_PROJECT_ID || process.env.REOWN_PROJECT_ID || process.env.WALLETCONNECT_PROJECT_ID
    }),
    ...(process.env.DEFAULT_CHAIN && { defaultChain: process.env.DEFAULT_CHAIN }),
    ...(process.env.DEFAULT_MIN_USD_VALUE && { defaultMinUsdValue: parseFloat(process.env.DEFAULT_MIN_USD_VALUE) }),
    ...(process.env.DEBUG === 'true' && { debug: true }),
  };
  
  return config;
}

/**
 * Save configuration to .uniterrc file
 */
export function saveConfig(config: Partial<UniterConfig>): void {
  try {
    const currentConfig = loadConfig();
    const newConfig = { ...currentConfig, ...config };
    
    // Remove sensitive data from file (keep in env vars only)
    const { oneinchApiKey, walletConnectProjectId, ...fileConfig } = newConfig;
    
    writeFileSync(CONFIG_FILE, JSON.stringify(fileConfig, null, 2));
  } catch (error) {
    throw new Error(`Failed to save configuration: ${error}`);
  }
}

/**
 * Validate that required configuration is present
 */
export function validateConfig(config: UniterConfig): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!config.oneinchApiKey) {
    missing.push('ONEINCH_API_KEY environment variable');
  }
  
  if (!config.walletConnectProjectId) {
    missing.push('VITE_WALLETCONNECT_PROJECT_ID environment variable');
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get the path to the configuration file
 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}