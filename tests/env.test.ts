import { describe, it, expect } from 'vitest';

// Simple test to check if environment variables are loaded
describe('Environment Variables', () => {
  it('should have required environment variables', () => {
    console.log('Environment variables test:');
    console.log('VITE_REOWN_PROJECT_ID:', import.meta.env.VITE_REOWN_PROJECT_ID);
    console.log('VITE_WALLETCONNECT_PROJECT_ID:', import.meta.env.VITE_WALLETCONNECT_PROJECT_ID);
    console.log('ONEINCH_API_KEY:', 'Hidden (server-side only)');
    
    // Basic assertions - only check client-side accessible variables
    expect(import.meta.env.VITE_REOWN_PROJECT_ID).toBeDefined();
    // ONEINCH_API_KEY should NOT be accessible to client-side code for security
    expect(import.meta.env.ONEINCH_API_KEY).toBeUndefined();
  });
});

// Export a dummy function to make this a valid module
export function testEnv() {
  return {
    VITE_REOWN_PROJECT_ID: import.meta.env.VITE_REOWN_PROJECT_ID,
    VITE_WALLETCONNECT_PROJECT_ID: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
    // ONEINCH_API_KEY is intentionally not exposed to client-side for security
  };
}
