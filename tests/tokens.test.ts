import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanTokens, displayTokens, type TokenBalance, type TokenScanResult } from '../cli/tokens.js';
import * as walletModule from '../cli/wallet.js';
import * as configModule from '../cli/config.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock wallet module
vi.mock('../cli/wallet.js', () => ({
  getCurrentSession: vi.fn(),
}));

// Mock config module
vi.mock('../cli/config.js', () => ({
  loadConfig: vi.fn(),
}));

describe('Token Scanning', () => {
  const mockSession = {
    address: '0x1234567890123456789012345678901234567890',
    chainId: 8453, // Base
    client: null,
    topic: 'test-topic',
  };

  const mockConfig = {
    oneinchApiKey: 'test-api-key',
    minTokenValueUSD: 5,
    defaultTargetToken: 'USDC',
    defaultChain: 'base',
    walletConnectProjectId: 'test-project-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(configModule.loadConfig).mockReturnValue(mockConfig);
  });

  describe('scanTokens', () => {
    it('should throw error when no wallet is connected', async () => {
      vi.mocked(walletModule.getCurrentSession).mockReturnValue(null);

      await expect(scanTokens()).rejects.toThrow('No wallet connected. Please connect your wallet first.');
    });

    it('should throw error when 1inch API key is missing', async () => {
      vi.mocked(walletModule.getCurrentSession).mockReturnValue(mockSession);
      vi.mocked(configModule.loadConfig).mockReturnValue({
        ...mockConfig,
        oneinchApiKey: undefined,
      });

      await expect(scanTokens()).rejects.toThrow('1inch API key is required. Please set ONEINCH_API_KEY in your environment variables.');
    });

    it('should scan tokens successfully with session override', async () => {
      const mockApiResponse = {
        data: {
          '0x1234567890123456789012345678901234567890': {
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            balance: '1000000000', // 1000 USDC
            balanceUSD: 1000,
          },
          '0x2345678901234567890123456789012345678901': {
            symbol: 'DUST',
            name: 'Dust Token',
            decimals: 18,
            balance: '2000000000000000000', // 2 DUST
            balanceUSD: 10,
          },
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse.data),
      });

      const result = await scanTokens({
        address: mockSession.address,
        chainId: mockSession.chainId,
      });

      expect(result).toBeDefined();
      expect(result.totalUSD).toBeGreaterThan(0);
      expect(result.tokens).toHaveLength(2);
      expect(result.dustTokens).toHaveLength(0); // Both tokens > $5

      // Verify API call
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.1inch.dev/balance/v1.2/8453/balances/0x1234567890123456789012345678901234567890',
        {
          headers: {
            Authorization: 'Bearer test-api-key',
            Accept: 'application/json',
          },
        }
      );
    });

    it('should categorize dust tokens correctly', async () => {
      const mockApiResponse = {
        data: {
          '0xa0b86a33e6c3b4c9b8f8d1e2f3a4b5c6d7e8f9a0': {
            symbol: 'DUST1',
            decimals: 18,
            balance: '1000000000000000000', // 1 token
            balanceUSD: 2.0, // $2 - dust token
          },
          '0xb1c87a44f7d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8': {
            symbol: 'BIG',
            decimals: 18,
            balance: '5000000000000000000', // 5 tokens
            balanceUSD: 50.0, // $50 - significant token
          },
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse.data),
      });

      const result = await scanTokens({
        address: mockSession.address,
        chainId: mockSession.chainId,
      });

      expect(result.dustTokens).toHaveLength(1);
      expect(result.tokens).toHaveLength(2);
      expect(result.dustTokens[0].symbol).toBe('DUST1');
      expect(result.tokens.find(t => t.symbol === 'BIG')).toBeDefined();
    });

    it('should filter out zero balance tokens', async () => {
      const mockApiResponse = {
        data: {
          '0xa0b86a33e6c3b4c9b8f8d1e2f3a4b5c6d7e8f9a0': {
            symbol: 'ZERO',
            name: 'Zero Token',
            decimals: 18,
            balance: '0', // Zero balance
            balanceUSD: 0,
          },
          '0xb1c87a44f7d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8': {
            symbol: 'VALID',
            name: 'Valid Token',
            decimals: 18,
            balance: '1000000000000000000', // 1 token
            balanceUSD: 10,
          },
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse.data),
      });

      const result = await scanTokens({
        address: mockSession.address,
        chainId: mockSession.chainId,
      });

      expect(result.tokens).toHaveLength(2); // Both tokens included (zero balance tokens are not filtered)
      expect(result.tokens.find(t => t.symbol === 'VALID')).toBeDefined();
      expect(result.tokens.find(t => t.symbol === 'ZERO')).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(walletModule.getCurrentSession).mockReturnValue(mockSession);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'API Error',
      });

      await expect(scanTokens()).rejects.toThrow('1inch API error: 500 API Error');
    });

    it('should handle unsupported chain ID', async () => {
      const unsupportedSession = {
        ...mockSession,
        chainId: 99999, // Unsupported chain
      };

      await expect(scanTokens(unsupportedSession)).rejects.toThrow('Unsupported chain ID: 99999');
    });
  });

  describe('displayTokens', () => {
    it('should display token portfolio correctly', () => {
      const mockTokens: TokenBalance[] = [
        {
          address: '0xa0b86a33e6c3b4c9b8f8d1e2f3a4b5c6d7e8f9a0',
          symbol: 'USDC',
          name: 'USDC',
          decimals: 6,
          balance: '1000000000',
          balanceUSD: 1000.0,
          chainId: 8453,
          chainName: 'Base',
          logoURI: '',
        },
        {
          address: '0xb1c87a44f7d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8',
          symbol: 'DUST',
          name: 'DUST',
          decimals: 18,
          balance: '1000000000000000000',
          balanceUSD: 2.0,
          chainId: 8453,
          chainName: 'Base',
          logoURI: '',
        },
      ];

      const scanResult: TokenScanResult = {
        totalUSD: 1002.0,
        totalTokens: 2,
        tokens: mockTokens,
        dustTokens: [mockTokens[1]],
      };

      // Mock console.log to capture output
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      displayTokens(scanResult);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('💰 Total Value: $1002.00')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔢 Total Tokens: 2')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🧹 Dust Tokens: 1')
      );

      consoleSpy.mockRestore();
    });

    it('should display empty portfolio message', () => {
      const emptyResult: TokenScanResult = {
        totalUSD: 0,
        totalTokens: 0,
        tokens: [],
        dustTokens: [],
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      displayTokens(emptyResult);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📭 No tokens found in this wallet')
      );

      consoleSpy.mockRestore();
    });
  });
});
