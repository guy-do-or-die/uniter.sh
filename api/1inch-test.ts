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

  res.status(200).json({
    message: '1inch API route test working',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    query: req.query,
    hasApiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
    environment: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV
  });
}
