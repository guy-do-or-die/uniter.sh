import type { VercelRequest, VercelResponse } from '@vercel/node';
import { proxyToOneInch, type ProxyRequest } from './proxy.js';

/**
 * Vercel API route for 1inch proxy
 * Handles requests to /api/1inch with path parsing
 */
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
    // Validate API key
    const apiKey = process.env.ONEINCH_API_KEY;
    if (!apiKey) {
      const availableKeys = Object.keys(process.env).filter(k => k.includes('ONEINCH'));
      console.error('❌ ONEINCH_API_KEY not found in Vercel API route');
      console.error('Available ONEINCH env vars:', availableKeys);
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    console.log(`✅ API key found in Vercel API route, length: ${apiKey.length}`);

    // Parse the path from the URL
    // URL will be like: /api/1inch/balance/v1.2/130/balances/0x...
    // We need to extract: balance/v1.2/130/balances/0x...
    const fullPath = req.url || '';
    const pathMatch = fullPath.match(/^\/api\/1inch\/(.+)$/);
    
    if (!pathMatch) {
      return res.status(400).json({ 
        error: 'Invalid path format',
        expectedFormat: '/api/1inch/{1inch-api-path}',
        receivedUrl: fullPath
      });
    }

    const apiPath = pathMatch[1];
    console.log(`🔗 Extracted API path: ${apiPath}`);

    // Build proxy request
    const proxyRequest: ProxyRequest = {
      url: fullPath, // Use the original request URL
      method: req.method || 'GET',
      body: req.body,
      query: req.query
    };

    // Use proxy utilities
    const proxyResponse = await proxyToOneInch(proxyRequest, apiKey, {
      logPrefix: '🚀 Vercel'
    });

    // Set response headers with debug info
    res.status(proxyResponse.status);
    res.setHeader('Content-Type', proxyResponse.headers['content-type'] || 'application/json');
    res.setHeader('X-Debug-Status', proxyResponse.status.toString());
    res.setHeader('X-Debug-Length', proxyResponse.data.length.toString());
    res.setHeader('X-Debug-Path', apiPath);

    // Try to parse as JSON, fallback to text
    try {
      const jsonData = JSON.parse(proxyResponse.data);
      
      // Add debug information for token metadata endpoints
      if (apiPath.includes('token/v1.2') && req.query.debug === 'true') {
        const debugInfo = {
          _debug: {
            originalPath: apiPath,
            responseStatus: proxyResponse.status,
            dataLength: proxyResponse.data.length,
            hasPrice: 'price' in jsonData,
            hasUsdPrice: 'usdPrice' in jsonData,
            keys: Object.keys(jsonData),
            priceData: jsonData.price || jsonData.usdPrice || 'No price found',
            dataPreview: proxyResponse.data.substring(0, 300)
          },
          ...jsonData
        };
        res.json(debugInfo);
      } else {
        res.json(jsonData);
      }
    } catch (parseError) {
      // Return parse error info in response
      res.status(500).json({
        error: 'JSON parse failed',
        parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        rawData: proxyResponse.data.substring(0, 500),
        path: apiPath,
        originalStatus: proxyResponse.status
      });
    }

  } catch (error) {
    console.error('Vercel proxy error:', error);
    res.status(500).json({ 
      error: 'Proxy request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
