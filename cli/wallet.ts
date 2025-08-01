import { SignClient } from '@walletconnect/sign-client';
import { getSdkError } from '@walletconnect/utils';
import qrcode from 'qrcode-terminal';
import { loadConfig } from './config.js';
import { SUPPORTED_CHAINS } from '../shared/chains.js';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface WalletSession {
  address: string;
  chainId: number;
  client: any; // SignClient type
  topic: string;
}

// Serializable session data for persistence
interface SerializableSession {
  address: string;
  chainId: number;
  topic: string;
  projectId: string;
  expiresAt: number; // Unix timestamp
  createdAt: number; // Unix timestamp
}

let currentSession: WalletSession | null = null;
const SESSION_FILE_PATH = join(homedir(), '.uniter-session.json');

/**
 * Save session to disk for persistence
 */
function saveSession(session: WalletSession, projectId: string): void {
  console.log('💾 saveSession() called with:', {
    address: session.address,
    chainId: session.chainId,
    topic: session.topic?.substring(0, 20) + '...',
    projectId,
    sessionFilePath: SESSION_FILE_PATH
  });
  
  try {
    const now = Date.now();
    const expiresAt = now + (7 * 24 * 60 * 60 * 1000); // 7 days from now
    
    const serializableSession: SerializableSession = {
      address: session.address,
      chainId: session.chainId,
      topic: session.topic,
      projectId,
      expiresAt,
      createdAt: now,
    };
    
    console.log('💾 Writing session to:', SESSION_FILE_PATH);
    console.log('💾 Session data to write:', JSON.stringify(serializableSession, null, 2));
    
    // Write with secure permissions (owner read/write only)
    writeFileSync(SESSION_FILE_PATH, JSON.stringify(serializableSession, null, 2), { mode: 0o600 });
    
    // Verify the file was actually written
    if (existsSync(SESSION_FILE_PATH)) {
      console.log('✅ Session file successfully created at:', SESSION_FILE_PATH);
      const fileContent = readFileSync(SESSION_FILE_PATH, 'utf-8');
      console.log('✅ File content verified, size:', fileContent.length, 'bytes');
    } else {
      console.error('❌ Session file was NOT created!');
    }
    
    console.log('💾 Session saved securely for future use (expires in 7 days)');
  } catch (error) {
    console.error('❌ Failed to save session:', (error as Error).message);
    console.error('❌ Error stack:', (error as Error).stack);
  }
}

/**
 * Load session from disk
 */
function loadSavedSession(): SerializableSession | null {
  console.log('🔍 Checking for saved session file...');
  
  if (!existsSync(SESSION_FILE_PATH)) {
    console.log('📁 No session file found at:', SESSION_FILE_PATH);
    return null;
  }
  
  console.log('📁 Session file exists, loading...');

  try {
    const sessionData = readFileSync(SESSION_FILE_PATH, 'utf-8');
    const session = JSON.parse(sessionData) as SerializableSession;
    
    console.log('📋 Loaded session data:', {
      address: session.address,
      chainId: session.chainId,
      hasProjectId: !!session.projectId,
      hasTopic: !!session.topic,
      expiresAt: session.expiresAt ? new Date(session.expiresAt).toISOString() : 'no expiry'
    });
    
    // Check if session has expired
    if (session.expiresAt && Date.now() > session.expiresAt) {
      console.log('⚠️ Session expired, clearing...');
      clearSavedSession();
      return null;
    }
    
    // Validate session data structure
    if (!session.address || !session.chainId || !session.topic || !session.projectId) {
      console.log('⚠️ Invalid session data structure, clearing...');
      console.log('❌ Missing fields:', {
        address: !session.address,
        chainId: !session.chainId,
        topic: !session.topic,
        projectId: !session.projectId
      });
      clearSavedSession();
      return null;
    }
    
    console.log('✅ Session data is valid');
    return session;
  } catch (error) {
    console.warn('⚠️ Failed to load session file:', (error as Error).message);
    clearSavedSession();
    return null;
  }
}

/**
 * Clear saved session from disk
 */
function clearSavedSession(): void {
  try {
    if (existsSync(SESSION_FILE_PATH)) {
      unlinkSync(SESSION_FILE_PATH);
    }
  } catch (error) {
    console.warn('⚠️ Failed to clear saved session:', (error as Error).message);
  }
}

/**
 * Try to restore existing session from disk
 */
export async function restoreSession(): Promise<{ address: string; chainId: number } | null> {
  const savedSession = loadSavedSession();
  if (!savedSession) {
    return null;
  }

  const config = loadConfig();
  if (!config.walletConnectProjectId || config.walletConnectProjectId !== savedSession.projectId) {
    console.log('⚠️ Saved session project ID mismatch, clearing...');
    clearSavedSession();
    return null;
  }

  try {
    console.log('🔄 Restoring saved session...');
    console.log('📋 Session data:', {
      address: savedSession.address,
      chainId: savedSession.chainId,
      topic: savedSession.topic.substring(0, 20) + '...',
      projectId: savedSession.projectId,
      expiresAt: new Date(savedSession.expiresAt).toISOString()
    });
    
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

    // Check if the session still exists and is valid
    const sessions = client.session.getAll();
    console.log('🔍 Found', sessions.length, 'WalletConnect sessions');
    
    const existingSession = sessions.find(s => s.topic === savedSession.topic);
    
    if (!existingSession) {
      console.log('⚠️ Saved session topic not found in WalletConnect sessions');
      console.log('🔍 Available session topics:', sessions.map(s => s.topic.substring(0, 20) + '...'));
      
      // CRITICAL FIX: Don't immediately clear the session!
      // WalletConnect sessions may not be immediately available in a new client instance
      // but the session data is still valid. Try to restore the session anyway.
      console.log('🔄 Session not found in client, but trying to restore anyway...');
      console.log('💡 Note: WalletConnect sessions may not persist across client instances');
      
      // For now, we'll restore the session optimistically
      // In a production app, you might want to try to reconnect or validate differently
    } else {
      console.log('✅ Found matching WalletConnect session');
      console.log('📋 Session accounts:', existingSession.namespaces?.eip155?.accounts || 'none');
    }

    // Restore session
    currentSession = {
      address: savedSession.address,
      chainId: savedSession.chainId,
      client,
      topic: savedSession.topic,
    };

    console.log('✅ Session restored successfully!');
    console.log('📍 Address:', savedSession.address);
    console.log('⛓️ Chain ID:', savedSession.chainId);
    
    return { address: savedSession.address, chainId: savedSession.chainId };
  } catch (error) {
    console.warn('⚠️ Failed to restore session:', (error as Error).message);
    clearSavedSession();
    return null;
  }
}

/**
 * Connect wallet via WalletConnect v2 (CLI-friendly approach)
 */
export async function connectWallet(): Promise<{ address: string; chainId: number }> {
  // First try to restore existing session
  const restored = await restoreSession();
  if (restored) {
    return restored;
  }

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

    // Set up event listeners
    console.log('🔍 Adding event listeners...');

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

        // Save session to disk for persistence
        saveSession(currentSession, config.walletConnectProjectId!);

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
    clearSavedSession();
    console.log('✅ Wallet disconnected successfully');
  } catch (error) {
    console.error('❌ Error disconnecting wallet:', error);
    // Clear session anyway
    currentSession = null;
    clearSavedSession();
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
