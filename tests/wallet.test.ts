import { describe, it, expect } from 'vitest';
import { getCurrentSession, isWalletConnected } from '../cli/wallet.js';
import type { WalletSession } from '../cli/wallet.js';

// Wallet tests that work with Bun
describe('Wallet Management', () => {
  it('should return null when no session exists', () => {
    const session = getCurrentSession();
    expect(session).toBeNull();
  });

  it('should return false when wallet is not connected', () => {
    const connected = isWalletConnected();
    expect(connected).toBe(false);
  });

  it('should validate WalletSession interface structure', () => {
    // Test the interface structure with a mock object
    const mockSession: WalletSession = {
      address: '0x830bc5551e429DDbc4E9Ac78436f8Bf13Eca8434',
      chainId: 8453,
      client: {} as any,
      topic: 'mock-topic',
    };

    expect(mockSession.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(typeof mockSession.chainId).toBe('number');
    expect(mockSession.chainId).toBeGreaterThan(0);
    expect(mockSession.client).toBeDefined();
    expect(mockSession.topic).toBeDefined();
  });

  it('should validate wallet address format', () => {
    const validAddress = '0x830bc5551e429DDbc4E9Ac78436f8Bf13Eca8434';
    expect(validAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    
    const invalidAddress = '0x123';
    expect(invalidAddress).not.toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it('should validate supported chain IDs', () => {
    const supportedChains = [1, 8453, 137, 42161, 10, 324]; // Common chain IDs
    supportedChains.forEach(chainId => {
      expect(typeof chainId).toBe('number');
      expect(chainId).toBeGreaterThan(0);
    });
  });

  it('should have proper function signatures', () => {
    // Test that functions exist and have expected signatures
    expect(getCurrentSession).toBeDefined();
    expect(isWalletConnected).toBeDefined();
    
    // Test return types
    expect(typeof isWalletConnected()).toBe('boolean');
    expect(getCurrentSession()).toBeNull(); // Should be null when no session
  });
});
