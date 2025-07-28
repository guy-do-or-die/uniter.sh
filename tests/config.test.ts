import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { loadConfig, saveConfig, validateConfig, getConfigPath } from '../cli/config';

const TEST_CONFIG_FILE = join(homedir(), '.uniterrc.test');

describe('Configuration Management', () => {
  beforeEach(() => {
    // Clean up any existing test config
    if (existsSync(TEST_CONFIG_FILE)) {
      unlinkSync(TEST_CONFIG_FILE);
    }
  });

  afterEach(() => {
    // Clean up test config
    if (existsSync(TEST_CONFIG_FILE)) {
      unlinkSync(TEST_CONFIG_FILE);
    }
  });

  it('should load default configuration when no file exists', () => {
    const config = loadConfig();
    
    expect(config.defaultTargetToken).toBe('USDC');
    expect(config.defaultChain).toBe('base');
    expect(config.defaultMinUsdValue).toBe(5);
    expect(config.maxSlippage).toBe(1);
  });

  it('should load configuration from environment variables', () => {
    // Set test environment variables
    process.env.DEFAULT_TARGET_TOKEN = 'USDT';
    process.env.DEFAULT_CHAIN = 'ethereum';
    process.env.DEFAULT_MIN_USD_VALUE = '10';
    process.env.ONEINCH_API_KEY = 'test-api-key';
    process.env.WALLETCONNECT_PROJECT_ID = 'test-project-id';

    const config = loadConfig();
    
    expect(config.defaultTargetToken).toBe('USDT');
    expect(config.defaultChain).toBe('ethereum');
    expect(config.defaultMinUsdValue).toBe(10);
    expect(config.oneinchApiKey).toBe('test-api-key');
    expect(config.walletConnectProjectId).toBe('test-project-id');

    // Clean up
    delete process.env.DEFAULT_TARGET_TOKEN;
    delete process.env.DEFAULT_CHAIN;
    delete process.env.DEFAULT_MIN_USD_VALUE;
    delete process.env.ONEINCH_API_KEY;
    delete process.env.WALLETCONNECT_PROJECT_ID;
  });

  it('should validate configuration correctly', () => {
    const validConfig = {
      oneinchApiKey: 'test-key',
      walletConnectProjectId: 'test-project',
      defaultTargetToken: 'USDC',
      defaultChain: 'base',
      defaultMinUsdValue: 5,
    };

    const validation = validateConfig(validConfig);
    expect(validation.valid).toBe(true);
    expect(validation.missing).toHaveLength(0);
  });

  it('should detect missing required configuration', () => {
    const invalidConfig = {
      defaultTargetToken: 'USDC',
      defaultChain: 'base',
      defaultMinUsdValue: 5,
    };

    const validation = validateConfig(invalidConfig);
    expect(validation.valid).toBe(false);
    expect(validation.missing).toContain('ONEINCH_API_KEY environment variable');
    expect(validation.missing).toContain('WALLETCONNECT_PROJECT_ID environment variable');
  });

  it('should return correct config file path', () => {
    const path = getConfigPath();
    expect(path).toBe(join(homedir(), '.uniterrc'));
  });
});
