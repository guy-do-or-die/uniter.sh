import { describe, it, expect } from 'vitest';

// Simple test to check if environment variables are loaded
describe('Environment Variables', () => {
  it('should have required environment variables', () => {
    console.log('Environment variables test:');
    console.log('VITE_REOWN_PROJECT_ID:', import.meta.env.VITE_REOWN_PROJECT_ID);
    console.log('VITE_WALLETCONNECT_PROJECT_ID:', import.meta.env.VITE_WALLETCONNECT_PROJECT_ID);
    console.log('VITE_ONEINCH_API_KEY:', import.meta.env.VITE_ONEINCH_API_KEY);
    
    // Basic assertions
    expect(import.meta.env.VITE_REOWN_PROJECT_ID).toBeDefined();
    expect(import.meta.env.VITE_ONEINCH_API_KEY).toBeDefined();
  });
});

// Export a dummy function to make this a valid module
export function testEnv() {
  return {
    VITE_REOWN_PROJECT_ID: import.meta.env.VITE_REOWN_PROJECT_ID,
    VITE_WALLETCONNECT_PROJECT_ID: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
    VITE_ONEINCH_API_KEY: import.meta.env.VITE_ONEINCH_API_KEY
  };
}
