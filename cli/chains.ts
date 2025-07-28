import { createPublicClient, http, PublicClient, Chain } from 'viem';
import * as chains from 'viem/chains';

// Supported chains - including both mainnet and testnet chains
export const SUPPORTED_CHAINS: Array<Chain> = [
  // Mainnet chains
  chains.mainnet,
  chains.base,
  chains.optimism,
  chains.arbitrum,
  chains.polygon,
  chains.bsc,
  // Testnet chains
  chains.sepolia,
  chains.baseSepolia,
  chains.monadTestnet,
  chains.optimismSepolia,
  chains.arbitrumSepolia,
  chains.zksyncSepoliaTestnet,
  chains.lineaSepolia,
  chains.scrollSepolia,
  chains.polygonMumbai,
  chains.bscTestnet,
];

// Cache for public clients
const clientCache = new Map<string, PublicClient>();

/**
 * Get a public client for a specific chain
 */
export function getPublicClient(chainName: string): PublicClient {
  const chain = SUPPORTED_CHAINS.find(chain => chain.name === chainName);
  if (!chain) {
    throw new Error(`Unsupported chain: ${chainName}`);
  }

  // Return cached client if available
  if (clientCache.has(chainName)) {
    return clientCache.get(chainName)!;
  }

  // Create new client using viem's chain definition
  const client = createPublicClient({
    chain,
    transport: http(),
  });

  // Cache the client
  clientCache.set(chainName, client);
  
  return client;
}

/**
 * Get chain configuration by name
 */
export function getChain(chainName: string): Chain {
  const chain = SUPPORTED_CHAINS.find(chain => chain.name === chainName);
  if (!chain) {
    throw new Error(`Unsupported chain: ${chainName}`);
  }
  return chain;
}

/**
 * Get chain configuration by chain ID
 */
export function getChainById(chainId: number): Chain | null {
  for (const [name, chain] of Object.entries(SUPPORTED_CHAINS)) {
    if (chain.id === chainId) {
      return chain;
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
