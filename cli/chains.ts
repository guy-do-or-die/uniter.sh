import { createPublicClient, http, PublicClient } from 'viem';
import { mainnet, polygon, arbitrum, optimism, base, bsc } from 'viem/chains';

// Chain configuration interface
export interface ChainConfig {
  id: number;
  name: string;
  viemChain: any;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// Supported chains configuration
export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    id: 1,
    name: 'Ethereum',
    viemChain: mainnet,
    rpcUrl: 'https://eth.llamarpc.com',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  polygon: {
    id: 137,
    name: 'Polygon',
    viemChain: polygon,
    rpcUrl: 'https://polygon.llamarpc.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
  },
  arbitrum: {
    id: 42161,
    name: 'Arbitrum One',
    viemChain: arbitrum,
    rpcUrl: 'https://arbitrum.llamarpc.com',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  optimism: {
    id: 10,
    name: 'Optimism',
    viemChain: optimism,
    rpcUrl: 'https://optimism.llamarpc.com',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  base: {
    id: 8453,
    name: 'Base',
    viemChain: base,
    rpcUrl: 'https://base.llamarpc.com',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  bsc: {
    id: 56,
    name: 'BNB Smart Chain',
    viemChain: bsc,
    rpcUrl: 'https://bsc.llamarpc.com',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
  },
};

// Cache for public clients
const clientCache = new Map<string, PublicClient>();

/**
 * Get a public client for a specific chain
 */
export function getPublicClient(chainName: string): PublicClient {
  const chain = SUPPORTED_CHAINS[chainName];
  if (!chain) {
    throw new Error(`Unsupported chain: ${chainName}`);
  }

  // Return cached client if available
  if (clientCache.has(chainName)) {
    return clientCache.get(chainName)!;
  }

  // Create new client
  const client = createPublicClient({
    chain: chain.viemChain,
    transport: http(chain.rpcUrl),
  });

  // Cache the client
  clientCache.set(chainName, client);
  
  return client;
}

/**
 * Get chain configuration by name
 */
export function getChainConfig(chainName: string): ChainConfig {
  const chain = SUPPORTED_CHAINS[chainName];
  if (!chain) {
    throw new Error(`Unsupported chain: ${chainName}`);
  }
  return chain;
}

/**
 * Get chain configuration by chain ID
 */
export function getChainConfigById(chainId: number): ChainConfig | null {
  for (const [name, config] of Object.entries(SUPPORTED_CHAINS)) {
    if (config.id === chainId) {
      return config;
    }
  }
  return null;
}

/**
 * Get list of all supported chain names
 */
export function getSupportedChains(): string[] {
  return Object.keys(SUPPORTED_CHAINS);
}

/**
 * Test connection to a chain
 */
export async function testChainConnection(chainName: string): Promise<boolean> {
  try {
    const client = getPublicClient(chainName);
    const blockNumber = await client.getBlockNumber();
    return blockNumber > 0n;
  } catch (error) {
    console.error(`Failed to connect to ${chainName}:`, error);
    return false;
  }
}
