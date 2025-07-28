import { SignClient } from '@walletconnect/sign-client';
import { getSdkError } from '@walletconnect/utils';
import qrcode from 'qrcode-terminal';
import { loadConfig } from './config.js';
import { SUPPORTED_CHAINS } from './chains.js';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

interface WalletSession {
  address: string;
  chainId: number;
  client: any; // SignClient type
  topic: string;
}

let currentSession: WalletSession | null = null;

/**
 * Connect wallet via WalletConnect v2 (CLI-friendly approach)
 */
export async function connectWallet(): Promise<{ address: string; chainId: number }> {
  const config = loadConfig();
  
  if (!config.walletConnectProjectId) {
    throw new Error('REOWN_PROJECT_ID or WALLETCONNECT_PROJECT_ID is required. Please set it in your environment variables.');
  }

  console.log('🔄 Initializing WalletConnect v2...');
  console.log('🔍 Project ID:', config.walletConnectProjectId ? 'Set ✅' : 'Missing ❌');

  // Initialize WalletConnect client
  const client = await SignClient.init({
    projectId: config.walletConnectProjectId,
    metadata: {
      name: 'uniter.sh',
      description: 'Unite all your onchain dust and scattered assets into a single token',
      url: 'https://github.com/guy-do-or-die/uniter.sh',
      icons: ['https://avatars.githubusercontent.com/u/37784886'],
    },
  });

  console.log('📱 Generating QR code for wallet connection...');

  return new Promise(async (resolve, reject) => {
    // Set up connection timeout
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout. Please try again.'));
    }, 300000); // 5 minute timeout

    // Add debugging to see if ANY events are being received
    console.log('🔍 Adding event listeners...');
    
    // Add a catch-all event listener to see what events we're getting
    const originalEmit = client.emit.bind(client);
    client.emit = function(event: any, ...args: any[]) {
      console.log('📡 Event emitted:', event, args.length > 0 ? 'with data' : 'no data');
      return originalEmit(event, ...args);
    } as any;

    client.on('session_proposal', async (event) => {
      console.log('📋 Session proposal received from wallet!');
      console.log('🔍 Proposal details:', {
        id: event.id,
        chains: Object.keys(event.params.requiredNamespaces || {}),
        methods: Object.values(event.params.requiredNamespaces || {}).map((ns: any) => ns.methods).flat(),
        optionalChains: Object.keys(event.params.optionalNamespaces || {})
      });
      
      console.log('⚠️ WAITING for wallet to provide accounts...');
      console.log('📱 Please approve the connection in your wallet app');
      
      // Wait for the wallet to approve and provide real accounts
      // We should NOT auto-approve here - let the wallet handle it
      console.log('🕰️ Waiting for wallet to approve and provide real accounts...');
    });

    // Listen for various session events that might contain real accounts
    client.on('session_update', async (event) => {
      console.log('🔄 Session update received!');
      console.log('🔍 Session update details:', event);
      
      try {
        const session = client.session.get(event.topic);
        console.log('✅ Session found, checking for real accounts...');
        
        const accounts = Object.values(session.namespaces)
          .map((namespace: any) => namespace.accounts)
          .flat();
        
        if (accounts.length > 0 && !accounts[0].includes('0x0000000000000000000000000000000000000000')) {
          console.log('✅ Real accounts found in session update!');
          
          // Parse account string (format: "eip155:1:0x...")
          const accountParts = accounts[0].split(':');
          const address = accountParts[2];
          const chainId = parseInt(accountParts[1]);

          // Store session
          currentSession = {
            address,
            chainId,
            client,
            topic: session.topic,
          };

          clearTimeout(timeout);
          resolve({ address, chainId });
        }
      } catch (error) {
        console.log('⚠️ Session update error (might be normal):', (error as Error).message);
      }
    });

    // Listen for session_connect which might be the event we need
    client.on('session_connect', async (event) => {
      console.log('🔗 Session connect received!');
      console.log('🔍 Session connect details:', event);
      
      try {
        const session = event.session;
        console.log('✅ Session connected with accounts!');
        console.log('🔍 Session details:', {
          topic: session.topic,
          namespaces: Object.keys(session.namespaces),
          accounts: Object.values(session.namespaces).map((ns: any) => ns.accounts).flat()
        });

        // Extract wallet info
        const accounts = Object.values(session.namespaces)
          .map((namespace: any) => namespace.accounts)
          .flat();
        
        if (accounts.length === 0) {
          console.log('⚠️ No accounts found in session_connect');
          return;
        }

        // Check if we have real accounts (not placeholder)
        if (accounts[0].includes('0x0000000000000000000000000000000000000000')) {
          console.log('⚠️ Still placeholder accounts, waiting for real ones...');
          return;
        }

        console.log('✅ Real accounts found!');
        
        // Parse account string (format: "eip155:1:0x...")
        const accountParts = accounts[0].split(':');
        const address = accountParts[2];
        const chainId = parseInt(accountParts[1]);

        // Store session
        currentSession = {
          address,
          chainId,
          client,
          topic: session.topic,
        };

        clearTimeout(timeout);
        resolve({ address, chainId });
      } catch (error) {
        console.error('❌ Failed to process session connect:', error);
      }
    });

    client.on('session_request', (event) => {
      console.log('📨 Session request received:', event);
    });

    // Add pairing event listeners
    client.on('session_ping', (event) => {
      console.log('🏓 Session ping received:', event);
    });

    client.on('session_event', (event) => {
      console.log('🎆 Session event received:', event);
    });

    // Add core pairing events
    client.core.pairing.events.on('pairing_ping', (event) => {
      console.log('🏓 Pairing ping:', event);
    });

    client.core.pairing.events.on('pairing_delete', (event) => {
      console.log('🗑️ Pairing deleted:', event);
    });

    // Listen for any pairing events
    client.core.pairing.events.on('pairing_created', (event) => {
      console.log('🎉 Pairing created:', event);
    });

    client.on('session_delete', (event) => {
      console.log('🗑️ Session deleted:', event);
    });

    client.on('session_expire', (event) => {
      console.log('⏰ Session expired:', event);
    });

    // Add general error handling
    client.core.relayer.on('relayer_error', (error: any) => {
      console.error('❌ Relayer error:', error);
    });

    // Log all events for debugging
    console.log('🔍 Setting up event listeners...');
    
    // Check if client is properly initialized
    console.log('🔍 Client initialized:', !!client);
    console.log('🔍 Client core:', !!client.core);
    console.log('🔍 Client relayer:', !!client.core?.relayer);

    // Create connection with proper error handling
    try {
      const { uri } = await client.connect({
        optionalNamespaces: {
          eip155: {
            methods: ['eth_sendTransaction', 'eth_signTransaction', 'eth_sign', 'personal_sign'],
            chains: ['eip155:1', 'eip155:11155111', 'eip155:137', 'eip155:8453'],
            events: ['accountsChanged', 'chainChanged'],
          },
        },
      });

      if (uri) {
        console.log('\n' + '='.repeat(60));
        console.log('📱 Scan this QR code with your wallet:');
        console.log('='.repeat(60));
        
        // Generate ASCII QR code with small option for better visibility
        qrcode.generate(uri, { small: true });
        
        console.log('='.repeat(60));
        console.log('🔗 Or copy this WalletConnect URI:');
        console.log('📋 ' + uri);
        console.log('='.repeat(60));
        console.log('⏳ Waiting for wallet connection...');
        console.log('💡 IMPORTANT: After scanning with MetaMask Mobile:');
        console.log('   1️⃣ Scan the QR code with your wallet camera');
        console.log('   2️⃣ Look for a "Connect" button in MetaMask and TAP IT');
        console.log('   3️⃣ Manually approve the connection in your wallet');
        console.log('🔄 Alternative wallets: Trust Wallet, Rainbow, WalletConnect app');
        
        // Log the URI for debugging
        console.log('🔍 Generated URI:', uri.substring(0, 50) + '...');
        
        // Explicitly call pairing to nudge the connection
        console.log('🔗 Initiating explicit pairing...');
        try {
          await client.core.pairing.pair({ uri });
          console.log('✅ Pairing initiated successfully');
        } catch (pairError) {
          console.log('⚠️ Pairing warning (this is often normal):', (pairError as Error).message);
        }
      } else {
        console.error('❌ No URI generated from WalletConnect client');
        reject(new Error('Failed to generate WalletConnect URI'));
      }
    } catch (error) {
      console.error('❌ Error creating WalletConnect connection:', error);
      clearTimeout(timeout);
      reject(error);
    }
  });
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet(): Promise<void> {
  if (!currentSession) {
    console.log('⚠️ No active wallet session to disconnect');
    return;
  }

  try {
    // Disconnect using WalletConnect client
    await currentSession.client.disconnect({
      topic: currentSession.topic,
      reason: getSdkError('USER_DISCONNECTED'),
    });
    
    currentSession = null;
    console.log('✅ Wallet disconnected successfully');
  } catch (error) {
    console.error('❌ Error disconnecting wallet:', error);
    // Clear session anyway
    currentSession = null;
  }
}

/**
 * Get current wallet session info
 */
export function getCurrentSession(): WalletSession | null {
  return currentSession;
}

/**
 * Check if wallet is currently connected
 */
export function isWalletConnected(): boolean {
  return currentSession !== null;
}
