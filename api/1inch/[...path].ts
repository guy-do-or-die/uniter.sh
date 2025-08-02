import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Get the API key from environment variables
    const apiKey = process.env.ONEINCH_API_KEY;
    if (!apiKey) {
      console.error('❌ ONEINCH_API_KEY not found in environment variables');
      console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('ONEINCH')));
      return res.status(500).json({ error: 'API key not configured' });
    }
    console.log('✅ API key found, length:', apiKey.length);

    // Extract the path from the request
    const { path } = req.query;
    if (!path || !Array.isArray(path)) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    // Reconstruct the API path
    const apiPath = path.join('/');
    
    // Build the full 1inch API URL
    const apiUrl = `https://api.1inch.dev/${apiPath}`;
    
    // Add query parameters if they exist
    const url = new URL(apiUrl);
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'path' && value) {
        url.searchParams.append(key, Array.isArray(value) ? value[0] : value);
      }
    });

    console.log(`🔗 Proxying request to: ${url.toString()}`);
    console.log(`📋 Request method: ${req.method}`);
    console.log(`🔑 Using API key: ${apiKey.substring(0, 8)}...`);

    // Make the request to 1inch API with proper headers
    const response = await fetch(url.toString(), {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    console.log(`📡 1inch API response: ${response.status} ${response.statusText}`);
    
    // Log response headers for debugging
    const responseHeaders = Object.fromEntries(response.headers.entries());
    console.log(`📋 Response headers:`, responseHeaders);

    // Forward the response
    const data = await response.text();
    console.log(`📄 Response data (first 200 chars):`, data.substring(0, 200));
    
    // If it's an error response, log the full response for debugging
    if (!response.ok) {
      console.error(`❌ 1inch API error response:`, data);
    }
    
    // Set the same status code and headers
    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    
    // Try to parse as JSON, fallback to text
    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch (parseError) {
      console.error('❌ Failed to parse response as JSON:', parseError);
      res.send(data);
    }

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Proxy request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
