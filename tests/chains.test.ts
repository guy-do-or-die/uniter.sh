import { describe, it, expect } from 'vitest';
import { 
  getChain, 
  getChainById, 
  getSupportedChains, 
  getPublicClient,
  testChainConnection,
  SUPPORTED_CHAINS 
} from '../core/chains';

describe('Chain Utilities', () => {
  it('should get chain config by name', () => {
    const baseChain = getChain('Base');
    expect(baseChain).not.toBeNull();
    expect(baseChain.name).toBe('Base');
  });

  it('should throw error for unsupported chain name', () => {
    expect(() => getChain('unsupported')).toThrow('Unsupported chain: unsupported');
  });

  it('should get chain config by ID', () => {
    const baseChain = getChainById(8453);
    expect(baseChain).not.toBeNull();
    expect(baseChain!.id).toBe(8453);
  });

  it('should return null for unsupported chain ID', () => {
    const chain = getChainById(999999);
    expect(chain).toBeNull();
  });

  it('should return list of supported chains', () => {
    const chainNames = getSupportedChains();
    
    // Since SUPPORTED_CHAINS is an array, getSupportedChains should return array indices as strings
    expect(Array.isArray(chainNames)).toBe(true);
    expect(chainNames.length).toBeGreaterThan(0);
  });

  it('should have supported chains array with mainnet chains', () => {
    expect(Array.isArray(SUPPORTED_CHAINS)).toBe(true);
    expect(SUPPORTED_CHAINS.length).toBeGreaterThan(0);
    
    // Check that we have some expected mainnet chains
    const chainNames = SUPPORTED_CHAINS.map(chain => chain.name);
    expect(chainNames).toContain('Base');
    expect(chainNames).toContain('Arbitrum One');
  });

  it('should create public client for supported chain', () => {
    const client = getPublicClient('Base');
    expect(client).not.toBeNull();
  });

  it('should throw error when creating client for unsupported chain', () => {
    expect(() => getPublicClient('unsupported')).toThrow('Unsupported chain: unsupported');
  });

  it('should cache public clients', () => {
    const client1 = getPublicClient('Base');
    const client2 = getPublicClient('Base');
    expect(client1).toBe(client2);
  });

  // Note: This test makes actual network calls, so we'll skip it in CI
  it.skip('should test chain connection', async () => {
    const isConnected = await testChainConnection('Base');
    expect(typeof isConnected).toBe('boolean');
  }, 10000); // 10 second timeout for network call
});
