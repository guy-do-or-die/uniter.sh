// Simple test to check if environment variables are loaded
console.log('Environment variables test:');
console.log('VITE_REOWN_PROJECT_ID:', import.meta.env.VITE_REOWN_PROJECT_ID);
console.log('VITE_WALLETCONNECT_PROJECT_ID:', import.meta.env.VITE_WALLETCONNECT_PROJECT_ID);
console.log('VITE_ONEINCH_API_KEY:', import.meta.env.VITE_ONEINCH_API_KEY);

// Export a dummy function to make this a valid module
export function testEnv() {
  return {
    VITE_REOWN_PROJECT_ID: import.meta.env.VITE_REOWN_PROJECT_ID,
    VITE_WALLETCONNECT_PROJECT_ID: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
    VITE_ONEINCH_API_KEY: import.meta.env.VITE_ONEINCH_API_KEY
  };
}
