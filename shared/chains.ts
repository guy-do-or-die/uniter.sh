import { createPublicClient, http, PublicClient, Chain } from 'viem';
import * as chains from 'viem/chains';


export const SUPPORTED_CHAINS: Array<Chain> = [
  chains.arbitrum,
  chains.avalanche,
  chains.base,
  chains.bsc,
  chains.gnosis,
  chains.linea,
  chains.mainnet,
  chains.optimism,
  chains.polygon,
  chains.sonic,
  chains.unichain,
  chains.zksync,
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
 * Get list of all supported chains with id and name
 */
export function getSupportedChains(): Array<{ id: number; name: string }> {
  return SUPPORTED_CHAINS.map(chain => ({ id: chain.id, name: chain.name }));
}

/**
 * Get list of all supported chain names only
 */
export function getSupportedChainNames(): string[] {
  return SUPPORTED_CHAINS.map(chain => chain.name);
}

/**
 * Get chain name by chain ID
 */
export function getChainName(chainId: number): string {
  const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
  return chain?.name || 'Unknown';
}

/**
 * Get chain ID by chain input (name or ID)
 */
export function getChainId(chainInput: string): number {
  // Try parsing as chain ID first
  const chainId = parseInt(chainInput);
  if (!isNaN(chainId)) {
    const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
    if (chain) {
      return chainId;
    }
  }
  
  // Fallback to name matching
  const normalizedInput = chainInput.toLowerCase();
  const chain = SUPPORTED_CHAINS.find(c => {
    const chainName = c.name.toLowerCase();
    return (
      chainName === normalizedInput ||
      (normalizedInput === 'arbitrum' && chainName.includes('arbitrum')) ||
      (normalizedInput === 'base' && chainName === 'base') ||
      (normalizedInput === 'ethereum' && chainName === 'ethereum') ||
      (normalizedInput === 'mainnet' && chainName === 'ethereum') ||
      (normalizedInput === 'polygon' && chainName === 'polygon')
    );
  });
  
  if (!chain) {
    const supportedNames = SUPPORTED_CHAINS.map(c => c.name.toLowerCase()).join(', ');
    throw new Error(`Unsupported chain: ${chainInput}. Supported: ${supportedNames}`);
  }
  return chain.id;
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
