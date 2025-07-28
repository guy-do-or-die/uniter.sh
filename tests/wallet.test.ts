import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  getCurrentSession, 
  isWalletConnected, 
  disconnectWallet,
  restoreSession
} from '../cli/wallet';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { SignClient } from '@walletconnect/sign-client';

// Mock fs operations
vi.mock('fs');
vi.mock('os');
vi.mock('path');

const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockExistsSync = vi.mocked(existsSync);
const mockUnlinkSync = vi.mocked(unlinkSync);
const mockHomedir = vi.mocked(homedir);
const mockJoin = vi.mocked(join);

// Mock config
vi.mock('../cli/config.js', () => ({
  loadConfig: vi.fn(() => ({
    walletConnectProjectId: 'test-project-id'
  }))
}));

// Mock WalletConnect SignClient
vi.mock('@walletconnect/sign-client', () => ({
  SignClient: {
    init: vi.fn()
  }
}));

vi.mock('@walletconnect/utils', () => ({
  getSdkError: vi.fn()
}));

vi.mock('qrcode-terminal', () => ({
  default: {
    generate: vi.fn()
  }
}));

describe('Wallet Connection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock returns
    mockHomedir.mockReturnValue('/home/testuser');
    mockJoin.mockImplementation((dir: string, file: string) => `${dir}/${file}`);
  });

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

describe('Session Storage', () => {
  const mockSessionData = {
    address: '0x1234567890123456789012345678901234567890',
    chainId: 8453,
    topic: 'test-topic-123',
    projectId: 'test-project-id',
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days from now
    createdAt: Date.now()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockHomedir.mockReturnValue('/home/testuser');
    mockJoin.mockImplementation((dir: string, file: string) => `${dir}/${file}`);
  });

  describe('restoreSession', () => {
    it('should return null when no session file exists', async () => {
      mockExistsSync.mockReturnValue(false);
      
      const result = await restoreSession();
      
      expect(result).toBeNull();
      expect(mockExistsSync).toHaveBeenCalled();
    });

    it('should return null when session file is invalid JSON', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json');
      
      const result = await restoreSession();
      
      expect(result).toBeNull();
    });

    it('should clear session when project ID mismatch', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        ...mockSessionData,
        projectId: 'different-project-id'
      }));
      
      const result = await restoreSession();
      
      expect(result).toBeNull();
      expect(mockUnlinkSync).toHaveBeenCalled();
    });

    it('should clear session when WalletConnect session not found', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockSessionData));
      vi.mocked(SignClient.init).mockResolvedValue({
        session: {
          getAll: vi.fn(() => []) // No existing sessions
        }
      } as any);
      
      const result = await restoreSession();
      
      expect(result).toBeNull();
      expect(mockUnlinkSync).toHaveBeenCalled();
    });

    it('should successfully restore valid session', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockSessionData));
      vi.mocked(SignClient.init).mockResolvedValue({
        session: {
          getAll: vi.fn(() => [{
            topic: 'test-topic-123',
            namespaces: {
              eip155: {
                accounts: ['eip155:8453:0x1234567890123456789012345678901234567890']
              }
            }
          }])
        }
      } as any);
      
      const result = await restoreSession();
      
      expect(result).toEqual({
        address: '0x1234567890123456789012345678901234567890',
        chainId: 8453
      });
      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    it('should handle SignClient initialization errors', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockSessionData));
      vi.mocked(SignClient.init).mockRejectedValue(new Error('SignClient init failed'));
      
      const result = await restoreSession();
      
      expect(result).toBeNull();
      expect(mockUnlinkSync).toHaveBeenCalled();
    });
  });

  describe('Session File Operations', () => {
    it('should handle missing session file gracefully', async () => {
      mockExistsSync.mockReturnValue(false);
      
      const result = await restoreSession();
      
      expect(result).toBeNull();
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });

    it('should handle file read errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });
      
      const result = await restoreSession();
      
      expect(result).toBeNull();
    });

    it('should use session file operations', async () => {
      mockExistsSync.mockReturnValue(false);
      
      await restoreSession();
      
      // Verify that file system operations are called
      expect(mockExistsSync).toHaveBeenCalled();
      expect(mockReadFileSync).not.toHaveBeenCalled(); // Should not read if file doesn't exist
    });
  });

  describe('Session Validation', () => {
    it('should validate session data structure', async () => {
      mockExistsSync.mockReturnValue(true);
      
      // Test with missing required fields
      const invalidSessions = [
        { address: '0x123' }, // missing chainId, topic, projectId
        { chainId: 1 }, // missing address, topic, projectId
        { topic: 'test' }, // missing address, chainId, projectId
        { projectId: 'test' }, // missing address, chainId, topic
        {} // empty object
      ];
      
      for (const invalidSession of invalidSessions) {
        mockReadFileSync.mockReturnValue(JSON.stringify(invalidSession));
        
        const result = await restoreSession();
        
        expect(result).toBeNull();
      }
    });

    it('should validate project ID matches current config', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        ...mockSessionData,
        projectId: 'wrong-project-id'
      }));
      
      const result = await restoreSession();
      
      expect(result).toBeNull();
      expect(mockUnlinkSync).toHaveBeenCalled();
    });

    it('should clear expired sessions', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        ...mockSessionData,
        expiresAt: Date.now() - 1000 // Expired 1 second ago
      }));
      
      const result = await restoreSession();
      
      expect(result).toBeNull();
      expect(mockUnlinkSync).toHaveBeenCalled();
    });

    it('should handle sessions without expiry (backward compatibility)', async () => {
      mockExistsSync.mockReturnValue(true);
      const legacySession = {
        address: '0x1234567890123456789012345678901234567890',
        chainId: 8453,
        topic: 'test-topic-123',
        projectId: 'test-project-id'
        // No expiresAt or createdAt fields
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(legacySession));
      vi.mocked(SignClient.init).mockResolvedValue({
        session: {
          getAll: vi.fn(() => [{
            topic: 'test-topic-123',
            namespaces: {
              eip155: {
                accounts: ['eip155:8453:0x1234567890123456789012345678901234567890']
              }
            }
          }])
        }
      } as any);
      
      const result = await restoreSession();
      
      expect(result).toEqual({
        address: '0x1234567890123456789012345678901234567890',
        chainId: 8453
      });
      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });
  });
});
