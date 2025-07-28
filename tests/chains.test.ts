import { describe, it, expect } from 'vitest';
import { 
  getChain, 
  getChainById, 
  getSupportedChains, 
  getPublicClient,
  testChainConnection,
  SUPPORTED_CHAINS 
} from '../cli/chains';

describe('Chain Utilities', () => {
  it('should get chain config by name', () => {
    const sepoliaChain = getChain('Sepolia');
    
    expect(sepoliaChain.id).toBe(11155111);
    expect(sepoliaChain.name).toBe('Sepolia');
    expect(sepoliaChain.nativeCurrency.symbol).toBe('ETH');
  });

  it('should throw error for unsupported chain name', () => {
    expect(() => getChain('unsupported')).toThrow('Unsupported chain: unsupported');
  });

  it('should get chain config by ID', () => {
    const sepoliaChain = getChainById(11155111);
    
    expect(sepoliaChain).not.toBeNull();
    expect(sepoliaChain!.name).toBe('Sepolia');
    expect(sepoliaChain!.nativeCurrency.symbol).toBe('ETH');
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

  it('should have supported chains array with testnet chains', () => {
    expect(Array.isArray(SUPPORTED_CHAINS)).toBe(true);
    expect(SUPPORTED_CHAINS.length).toBeGreaterThan(0);
    
    // Check that we have some expected testnet chains
    const chainNames = SUPPORTED_CHAINS.map(chain => chain.name);
    expect(chainNames).toContain('Sepolia');
    expect(chainNames).toContain('Polygon Mumbai');
  });

  it('should create public client for supported chain', () => {
    const client = getPublicClient('Sepolia');
    expect(client).toBeDefined();
    expect(typeof client.getBlockNumber).toBe('function');
  });

  it('should throw error when creating client for unsupported chain', () => {
    expect(() => getPublicClient('unsupported')).toThrow('Unsupported chain: unsupported');
  });

  it('should cache public clients', () => {
    const client1 = getPublicClient('Sepolia');
    const client2 = getPublicClient('Sepolia');
    
    // Should return the same cached instance
    expect(client1).toBe(client2);
  });

  // Note: This test makes actual network calls, so we'll skip it in CI
  it.skip('should test chain connection', async () => {
    const isConnected = await testChainConnection('Sepolia');
    expect(typeof isConnected).toBe('boolean');
  }, 10000); // 10 second timeout for network call
});
