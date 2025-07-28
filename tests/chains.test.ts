import { describe, it, expect } from 'vitest';
import { 
  getChainConfig, 
  getChainConfigById, 
  getSupportedChains, 
  getPublicClient,
  testChainConnection 
} from '../cli/chains';

describe('Chain Utilities', () => {
  it('should get chain config by name', () => {
    const baseConfig = getChainConfig('base');
    
    expect(baseConfig.id).toBe(8453);
    expect(baseConfig.name).toBe('Base');
    expect(baseConfig.nativeCurrency.symbol).toBe('ETH');
  });

  it('should throw error for unsupported chain name', () => {
    expect(() => getChainConfig('unsupported')).toThrow('Unsupported chain: unsupported');
  });

  it('should get chain config by ID', () => {
    const ethereumConfig = getChainConfigById(1);
    
    expect(ethereumConfig).not.toBeNull();
    expect(ethereumConfig!.name).toBe('Ethereum');
    expect(ethereumConfig!.nativeCurrency.symbol).toBe('ETH');
  });

  it('should return null for unsupported chain ID', () => {
    const config = getChainConfigById(999999);
    expect(config).toBeNull();
  });

  it('should return list of supported chains', () => {
    const chains = getSupportedChains();
    
    expect(chains).toContain('ethereum');
    expect(chains).toContain('base');
    expect(chains).toContain('polygon');
    expect(chains).toContain('arbitrum');
    expect(chains).toContain('optimism');
    expect(chains).toContain('bsc');
    expect(chains.length).toBe(6);
  });

  it('should create public client for supported chain', () => {
    const client = getPublicClient('base');
    expect(client).toBeDefined();
    expect(typeof client.getBlockNumber).toBe('function');
  });

  it('should throw error when creating client for unsupported chain', () => {
    expect(() => getPublicClient('unsupported')).toThrow('Unsupported chain: unsupported');
  });

  it('should cache public clients', () => {
    const client1 = getPublicClient('base');
    const client2 = getPublicClient('base');
    
    // Should return the same cached instance
    expect(client1).toBe(client2);
  });

  // Note: This test makes actual network calls, so we'll skip it in CI
  it.skip('should test chain connection', async () => {
    const isConnected = await testChainConnection('base');
    expect(typeof isConnected).toBe('boolean');
  }, 10000); // 10 second timeout for network call
});
