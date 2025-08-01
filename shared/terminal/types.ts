export interface TerminalOutput {
  type: 'text' | 'error' | 'success' | 'warning' | 'info' | 'table' | 'banner';
  content: string;
  data?: any;
}

export interface TerminalCommand {
  name: string;
  description: string;
  aliases?: string[];
  args?: string[];
  handler: (args: string[]) => Promise<TerminalOutput[]>;
}

export interface TerminalEnvironment {
  isNode: boolean;
  isBrowser: boolean;
  canConnectWallet: boolean;
  canScanTokens: boolean;
}

/**
 * Environment adapter interface for platform-specific functionality
 */
export interface EnvironmentAdapter {
  // Wallet operations
  connectWallet(): Promise<any>;
  disconnectWallet(): Promise<void>;
  isWalletConnected(): boolean;
  getCurrentSession(): any;
  restoreSession(): Promise<any>;
  
  // Token operations
  scanTokens(session: any, chainId: number, onProgress?: (progress: any) => void): Promise<any>;
  scanTokensMultiChain(session: any, onProgress?: (progress: any) => void): Promise<any>;
 
  // Environment info
  getEnvironment(): TerminalEnvironment;
}

/**
 * Terminal renderer interface for environment-specific rendering
 */
export interface TerminalRenderer {
  // Core rendering methods
  write(content: string): void;
  writeln(content: string): void;
  clear(): void;
  
  // Styled output methods
  writeSuccess(content: string): void;
  writeError(content: string): void;
  writeWarning(content: string): void;
  writeInfo(content: string): void;
  writeBanner(content: string): void;
  
  // Progress update methods
  updateProgress(content: string): void;
  clearProgress(): void;
  
  // Input/prompt methods
  showPrompt(prompt: string): void;
  getCurrentInput(): string;
  clearCurrentInput(): void;
  
  // Event handling
  onInput(callback: (input: string) => void): void;
  onExit(callback: () => void): void;
  
  // Lifecycle
  init(): Promise<void>;
  cleanup(): void;
}
