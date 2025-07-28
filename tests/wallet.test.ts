import { describe, it, expect } from 'vitest';
import { 
  getCurrentSession, 
  isWalletConnected, 
  disconnectWallet 
} from '../cli/wallet';

describe('Wallet Connection', () => {
  it('should start with no wallet connected', () => {
    expect(isWalletConnected()).toBe(false);
    expect(getCurrentSession()).toBeNull();
  });

  it('should handle disconnect when no session exists', async () => {
    // Should not throw error when disconnecting with no active session
    await expect(disconnectWallet()).resolves.toBeUndefined();
  });

  it('should export wallet connection functions', () => {
    expect(typeof getCurrentSession).toBe('function');
    expect(typeof isWalletConnected).toBe('function');
    expect(typeof disconnectWallet).toBe('function');
  });

  it('should have proper function signatures', () => {
    // Test that functions exist and have expected signatures
    expect(getCurrentSession).toBeDefined();
    expect(isWalletConnected).toBeDefined();
    expect(disconnectWallet).toBeDefined();
    
    // Test return types
    expect(typeof isWalletConnected()).toBe('boolean');
    expect(getCurrentSession()).toBeNull(); // Should be null when no session
  });
});
