import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Test environment variable access
  const apiKey = process.env.ONEINCH_API_KEY;
  const hasApiKey = !!apiKey;
  const apiKeyLength = apiKey ? apiKey.length : 0;

  res.status(200).json({
    message: 'Test API route working',
    timestamp: new Date().toISOString(),
    method: req.method,
    hasApiKey,
    apiKeyLength,
    environment: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    availableEnvVars: Object.keys(process.env).filter(k => k.includes('ONEINCH')).length
  });
}
