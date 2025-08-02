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
let globalSignClient: any = null; // Reuse SignClient instance
const SESSION_FILE_PATH = join(homedir(), '.uniter-session.json');

/**
 * Save session to disk for persistence
 */
function saveSession(session: WalletSession, projectId: string): void {
  const config = loadConfig();
  
  if (config.debug) {
    console.log('saveSession() called with:', {
      address: session.address,
      chainId: session.chainId,
      topic: session.topic?.substring(0, 20) + '...',
      projectId,
      sessionFilePath: SESSION_FILE_PATH
    });
  }
  
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
    
    if (config.debug) {
      console.log('Writing session to:', SESSION_FILE_PATH);
      console.log('Session data to write:', JSON.stringify(serializableSession, null, 2));
    }
    
    // Write with secure permissions (owner read/write only)
    writeFileSync(SESSION_FILE_PATH, JSON.stringify(serializableSession, null, 2), { mode: 0o600 });
    
    // Verify the file was actually written
    if (existsSync(SESSION_FILE_PATH)) {
      if (config.debug) {
        console.log('Session file successfully created at:', SESSION_FILE_PATH);
        const fileContent = readFileSync(SESSION_FILE_PATH, 'utf-8');
        console.log('File content verified, size:', fileContent.length, 'bytes');
      }
    } else {
      console.error('Session file was NOT created!');
    }
    
    if (config.debug) {
      console.log('Session saved securely for future use (expires in 7 days)');
    }
  } catch (error) {
    console.error('Failed to save session:', (error as Error).message);
    if (config.debug) {
      console.error('Error stack:', (error as Error).stack);
    }
  }
}

/**
 * Load session from disk
 */
function loadSavedSession(): SerializableSession | null {
  const config = loadConfig();
  
  if (config.debug) {
    console.log('Checking for saved session file...');
  }
  
  if (!existsSync(SESSION_FILE_PATH)) {
    if (config.debug) {
      console.log('No session file found at:', SESSION_FILE_PATH);
    }
    return null;
  }
  
  if (config.debug) {
    console.log('Session file exists, loading...');
  }

  try {
    const sessionData = readFileSync(SESSION_FILE_PATH, 'utf-8');
    const session = JSON.parse(sessionData) as SerializableSession;
    
    if (config.debug) {
      console.log('Loaded session data:', {
        address: session.address,
        chainId: session.chainId,
        hasProjectId: !!session.projectId,
        hasTopic: !!session.topic,
        expiresAt: session.expiresAt ? new Date(session.expiresAt).toISOString() : 'no expiry'
      });
    }
    
    // Check if session has expired
    if (session.expiresAt && Date.now() > session.expiresAt) {
      console.log('Session expired, clearing...');
      clearSavedSession();
      return null;
    }
    
    // Validate session data structure
    if (!session.address || !session.chainId || !session.topic || !session.projectId) {
      console.log('⚠️ Invalid session data structure, clearing...');
      if (config.debug) {
        console.log('❌ Missing fields:', {
          address: !session.address,
          chainId: !session.chainId,
          topic: !session.topic,
          projectId: !session.projectId
        });
      }
      clearSavedSession();
      return null;
    }
    
    if (config.debug) {
      console.log('Session data is valid');
    }
    return session;
  } catch (error) {
    console.warn('Failed to load session file:', (error as Error).message);
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
  const config = loadConfig();
  if (config.debug) {
    console.log('🔍 DEBUG: Starting session restoration process...');
  }
  
  const savedSession = loadSavedSession();
  if (!savedSession) {
    if (config.debug) {
      console.log('❌ DEBUG: No saved session found');
    }
    return null;
  }
  
  if (config.debug) {
    console.log('✅ DEBUG: Saved session loaded successfully');
  }

  if (config.debug) {
    console.log('🔧 DEBUG: Config loaded, checking project ID...');
    console.log('🔧 DEBUG: Config project ID:', config.walletConnectProjectId);
    console.log('🔧 DEBUG: Session project ID:', savedSession.projectId);
  }
  
  if (!config.walletConnectProjectId || config.walletConnectProjectId !== savedSession.projectId) {
    if (config.debug) {
      console.log('❌ DEBUG: Saved session project ID mismatch, clearing...');
    }
    clearSavedSession();
    return null;
  }
  
  if (config.debug) {
    console.log('✅ DEBUG: Project ID matches, proceeding with restoration...');
  }

  try {
    if (config.debug) {
      console.log('🔄 DEBUG: Initializing WalletConnect client...');
      console.log('📋 DEBUG: Session data:', {
        address: savedSession.address,
        chainId: savedSession.chainId,
        topic: savedSession.topic.substring(0, 20) + '...',
        projectId: savedSession.projectId,
        expiresAt: new Date(savedSession.expiresAt).toISOString()
      });
    }
    
    let client = globalSignClient;
    if (!client) {
      client = await SignClient.init({
        projectId: config.walletConnectProjectId,
        metadata: {
          name: 'uniter.sh',
          description: 'Unite all your onchain dust and scattered assets into a single token',
          url: 'https://github.com/guy-do-or-die/uniter.sh',
          icons: ['https://avatars.githubusercontent.com/u/37784886'],
        },
      });
      globalSignClient = client;
    }
    if (config.debug) {
      console.log('✅ DEBUG: SignClient initialized successfully');
    }

    // Check if the session still exists and is valid
    const sessions = client.session.getAll();
    if (config.debug) {
      console.log('🔍 Found', sessions.length, 'WalletConnect sessions');
    }
    
    const existingSession = sessions.find((s: any) => s.topic === savedSession.topic);
    
    if (!existingSession) {
      if (config.debug) {
        console.log('⚠️ Saved session topic not found in WalletConnect sessions');
        console.log('🔍 Available session topics:', sessions.map((s: any) => s.topic.substring(0, 20) + '...'));
      }
      
      // Set currentSession with saved data even if WalletConnect session is stale
      // This allows CLI to show wallet as connected and use saved session data
      currentSession = {
        address: savedSession.address,
        chainId: savedSession.chainId,
        client,
        topic: savedSession.topic,
      };
      
      console.log('💾 Session restored from saved data (WalletConnect session stale)');
      if (config.debug) {
        console.log('💡 Use "connect" command to re-establish live WalletConnect connection');
        console.log('✅ DEBUG: currentSession set with saved data');
      }
      
      return { address: savedSession.address, chainId: savedSession.chainId };
    }
    
    console.log('✅ Found matching WalletConnect session');
    console.log('📋 Session accounts:', existingSession.namespaces?.eip155?.accounts || 'none');
    
    // Validate that the session is actually active and has accounts
    const accounts = Object.values(existingSession.namespaces || {})
      .map((namespace: any) => namespace.accounts)
      .flat();
      
    if (accounts.length === 0) {
      console.log('⚠️ Session has no accounts, clearing stale session');
      clearSavedSession();
      return null;
    }

    // Restore session
    currentSession = {
      address: savedSession.address,
      chainId: savedSession.chainId,
      client,
      topic: savedSession.topic,
    };

    console.log('✅ DEBUG: Session restored successfully!');
    console.log('📍 DEBUG: Address:', savedSession.address);
    console.log('⛓️ DEBUG: Chain ID:', savedSession.chainId);
    console.log('🎯 DEBUG: currentSession set, returning session data');
    
    return { address: savedSession.address, chainId: savedSession.chainId };
  } catch (error) {
    console.error('❌ DEBUG: Failed to restore session:', (error as Error).message);
    console.error('❌ DEBUG: Error stack:', (error as Error).stack);
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

  console.log('Connecting to wallet...');
  
  if (config.debug) {
    console.log('Project ID:', config.walletConnectProjectId ? 'Set' : 'Missing');
    console.log('Setting up event listeners...');
  }

  // Initialize WalletConnect client (reuse existing if available)
  let client = globalSignClient;
  if (!client) {
    client = await SignClient.init({
      projectId: config.walletConnectProjectId,
      metadata: {
        name: 'uniter.sh',
        description: 'Unite all your onchain dust and scattered assets into a single token',
        url: 'https://github.com/guy-do-or-die/uniter.sh',
        icons: ['https://avatars.githubusercontent.com/u/37784886'],
      },
    });
    globalSignClient = client;
  }

  return new Promise(async (resolve, reject) => {
    // Set up connection timeout
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout. Please try again.'));
    }, 300000); // 5 minute timeout

    // Set up event listeners
    if (config.debug) {
      console.log('Adding event listeners...');
    }

    client.on('session_proposal', async (event: any) => {
      console.log('Please approve the connection in your wallet app');
      
      if (config.debug) {
        console.log('Session proposal received from wallet!');
        console.log('Proposal details:', {
          id: event.id,
          chains: Object.keys(event.params.requiredNamespaces || {}),
          methods: Object.values(event.params.requiredNamespaces || {}).map((ns: any) => ns.methods).flat(),
          optionalChains: Object.keys(event.params.optionalNamespaces || {})
        });
        console.log('Waiting for wallet to approve and provide real accounts...');
      }
    });

    // Listen for various session events that might contain real accounts
    client.on('session_update', async (event: any) => {
      if (config.debug) {
        console.log('Session update received!');
        console.log('Session update details:', event);
      }
      
      try {
        const session = client.session.get(event.topic);
        if (config.debug) {
          console.log('Session found, checking for real accounts...');
        }
        
        const accounts = Object.values(session.namespaces)
          .map((namespace: any) => namespace.accounts)
          .flat();
        
        if (accounts.length > 0 && !accounts[0].includes('0x0000000000000000000000000000000000000000')) {
          console.log('Wallet connected successfully');
          
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
        if (config.debug) {
          console.log('Session update error (might be normal):', (error as Error).message);
        }
      }
    });

    // Listen for session_connect which might be the event we need
    client.on('session_connect', async (event: any) => {
      if (config.debug) {
        console.log('Session connect received!');
        console.log('Session connect details:', event);
      }
      
      try {
        const session = event.session;
        if (config.debug) {
          console.log('Session connected with accounts!');
          console.log('Session details:', {
            topic: session.topic,
            namespaces: Object.keys(session.namespaces),
            accounts: Object.values(session.namespaces).map((ns: any) => ns.accounts).flat()
          });
        }

        // Extract wallet info
        const accounts = Object.values(session.namespaces)
          .map((namespace: any) => namespace.accounts)
          .flat();
        
        if (accounts.length === 0) {
          if (config.debug) {
            console.log('No accounts found in session_connect');
          }
          return;
        }

        // Check if we have real accounts (not placeholder)
        if (accounts[0].includes('0x0000000000000000000000000000000000000000')) {
          if (config.debug) {
            console.log('Still placeholder accounts, waiting for real ones...');
          }
          return;
        }

        if (config.debug) {
          console.log('Real accounts found!');
        }
        
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
        console.error('Failed to process session connect:', error);
      }
    });

    if (config.debug) {
      client.on('session_request', (event: any) => {
        console.log('Session request received:', event);
      });

      // Add pairing event listeners
      client.on('session_ping', (event: any) => {
        console.log('Session ping received:', event);
      });

      client.on('session_event', (event: any) => {
        console.log('Session event received:', event);
      });

      // Add core pairing events
      client.core.pairing.events.on('pairing_ping', (event: any) => {
        console.log('Pairing ping:', event);
      });

      client.core.pairing.events.on('pairing_delete', (event: any) => {
        console.log('Pairing deleted:', event);
      });

      // Listen for any pairing events
      client.core.pairing.events.on('pairing_created', (event: any) => {
        console.log('Pairing created:', event);
      });

      client.on('session_delete', (event: any) => {
        console.log('Session deleted:', event);
      });

      client.on('session_expire', (event: any) => {
        console.log('Session expired:', event);
      });

      // Add general error handling
      client.core.relayer.on('relayer_error', (error: any) => {
        console.error('Relayer error:', error);
      });
    }

    // Log all events for debugging
    if (config.debug) {
      console.log('Setting up event listeners...');
      
      // Check if client is properly initialized
      console.log('Client initialized:', !!client);
      console.log('Client core:', !!client.core);
      console.log('Client relayer:', !!client.core?.relayer);
    }

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
        console.log('\nScan QR code with your wallet:\n');
        qrcode.generate(uri, { small: true });
        console.log('Waiting for wallet connection...');
        
        if (config.debug) {
          console.log('WalletConnect URI:');
          console.log(uri);
          console.log('Instructions:');
          console.log('   1. Scan the QR code with your wallet camera');
          console.log('   2. Look for a "Connect" button in MetaMask and TAP IT');
          console.log('   3. Manually approve the connection in your wallet');
          console.log('Alternative wallets: Trust Wallet, Rainbow, WalletConnect app');
          console.log('Generated URI:', uri.substring(0, 50) + '...');
          console.log('   2️⃣ Look for a "Connect" button in MetaMask and TAP IT');
          console.log('   3️⃣ Manually approve the connection in your wallet');
          console.log('🔄 Alternative wallets: Trust Wallet, Rainbow, WalletConnect app');
          console.log('🔍 Generated URI:', uri.substring(0, 50) + '...');
        }
        
        // Explicitly call pairing to nudge the connection
        if (config.debug) {
          console.log('Initiating explicit pairing...');
        }
        try {
          await client.core.pairing.pair({ uri });
          if (config.debug) {
            console.log('Pairing initiated successfully');
          }
        } catch (pairError) {
          if (config.debug) {
            console.log('Pairing warning (this is often normal):', (pairError as Error).message);
          }
        }
      } else {
        console.error('No URI generated from WalletConnect client');
        reject(new Error('Failed to generate WalletConnect URI'));
      }
    } catch (error) {
      console.error('Error creating WalletConnect connection:', error);
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
    console.log('No active wallet session to disconnect');
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
    console.log('Wallet disconnected successfully');
  } catch (error) {
    console.error('Error disconnecting wallet:', error);
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
