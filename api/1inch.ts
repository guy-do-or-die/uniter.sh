import { VercelRequest, VercelResponse } from '@vercel/node';
import { proxyToOneInch, ProxyRequest } from './proxy.js';

// Edge-compatible logging function
async function edgeLog(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
    source: '1inch-api'
  };
  
  // Send to webhook (if DEBUG_WEBHOOK_URL is set)
  const webhookUrl = process.env.DEBUG_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      });
    } catch (e) {
      // Fail silently for webhook logging
    }
  }
  
  // Also use console as fallback
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logFn(`[${level.toUpperCase()}] ${message}`, data || '');
}

// Helper functions for debug analysis
function getEndpointType(apiPath: string): string {
  if (apiPath.includes('/balance/')) return 'balance';
  if (apiPath.includes('/token/') && apiPath.includes('/search')) return 'token-search';
  if (apiPath.includes('/token/')) return 'token-metadata';
  if (apiPath.includes('/swap/')) return 'swap-quote';
  return 'unknown';
}

function analyzeDataStructure(data: any): string {
  if (Array.isArray(data)) {
    return `array[${data.length}]`;
  }
  if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data);
    if (keys.length === 0) return 'empty-object';
    if (keys.every(key => key.startsWith('0x'))) return 'address-keyed-object';
    if (data.tokens && Array.isArray(data.tokens)) return 'tokens-wrapper';
    return `object[${keys.length}-keys]`;
  }
  return typeof data;
}

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
    // Check if debug mode is enabled
    const isDebug = true;//req.query.debug === 'true';
    await edgeLog('info', '🔧 DEBUG MODE ENABLED - Starting 1inch API request', {
      method: req.method,
      url: req.url,
      query: req.query
    });
    
    // Validate API key
    const apiKey = process.env.ONEINCH_API_KEY;
    if (!apiKey) {
      const availableKeys = Object.keys(process.env).filter(k => k.includes('ONEINCH'));
      console.error('❌ ONEINCH_API_KEY not found in Vercel API route');
      console.error('Available ONEINCH env vars:', availableKeys);
      if (isDebug) {
        console.warn('⚠️ API key missing - this will cause all 1inch requests to fail');
      }
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    if (isDebug) {
      await edgeLog('info', `✅ API key found in Vercel API route, length: ${apiKey.length}`);
      if (apiKey.length < 32) {
        await edgeLog('warn', '⚠️ API key seems unusually short, may be invalid');
      }
    }

    // Parse the path from the URL
    // URL will be like: /api/1inch/balance/v1.2/130/balances/0x...
    // We need to extract: balance/v1.2/130/balances/0x...
    const fullPath = req.url || '';
    const pathMatch = fullPath.match(/^\/api\/1inch\/(.+)$/);
    
    if (!pathMatch) {
      if (isDebug) {
        await edgeLog('warn', `⚠️ Invalid path format received: ${fullPath}`);
      }
      return res.status(400).json({ 
        error: 'Invalid path format',
        expectedFormat: '/api/1inch/{1inch-api-path}',
        receivedUrl: fullPath
      });
    }

    const apiPath = pathMatch[1];
    if (isDebug) {
      await edgeLog('info', `🔗 Extracted API path: ${apiPath}`);
      
      // Warn about potentially problematic paths
      if (apiPath.includes('..') || apiPath.includes('//')) {
        await edgeLog('warn', `⚠️ Suspicious path detected: ${apiPath}`);
      }
      if (!apiPath.includes('/v1.')) {
        await edgeLog('warn', `⚠️ Path doesn't contain version info, may be invalid: ${apiPath}`);
      }
    }

    // Build proxy request
    const proxyRequest: ProxyRequest = {
      url: fullPath, // Use the original request URL
      method: req.method || 'GET',
      body: req.body,
      query: req.query
    };

    // Use proxy utilities
    if (isDebug) {
      await edgeLog('info', `📡 Making 1inch API request: ${req.method} ${apiPath}`);
    }
    const proxyResponse = await proxyToOneInch(proxyRequest, apiKey, {
      logPrefix: isDebug ? '🚀 Vercel' : undefined
    });
    
    // Warn about non-200 responses
    if (isDebug) {
      if (proxyResponse.status !== 200) {
        await edgeLog('warn', `⚠️ 1inch API returned non-200 status: ${proxyResponse.status} for ${apiPath}`);
      }
      if (proxyResponse.data.length === 0) {
        await edgeLog('warn', `⚠️ 1inch API returned empty response for ${apiPath}`);
      }
    }

    // Set response headers with debug info
    res.status(proxyResponse.status);
    res.setHeader('Content-Type', proxyResponse.headers['content-type'] || 'application/json');
    res.setHeader('X-Debug-Status', proxyResponse.status.toString());
    res.setHeader('X-Debug-Length', proxyResponse.data.length.toString());
    res.setHeader('X-Debug-Path', apiPath);
    res.setHeader('X-Debug-Endpoint-Type', getEndpointType(apiPath));
    
    // Add debug warnings as headers when in debug mode
    if (isDebug) {
      const warnings = [];
      if (apiKey && apiKey.length < 32) {
        warnings.push('api-key-short');
      }
      if (apiPath.includes('..') || apiPath.includes('//')) {
        warnings.push('suspicious-path');
      }
      if (!apiPath.includes('/v1.')) {
        warnings.push('missing-version');
      }
      if (proxyResponse.status !== 200) {
        warnings.push(`non-200-status-${proxyResponse.status}`);
      }
      if (proxyResponse.data.length === 0) {
        warnings.push('empty-response');
      }
      
      if (warnings.length > 0) {
        res.setHeader('X-Debug-Warnings', warnings.join(','));
      }
    }

    // Try to parse as JSON, fallback to text
    try {
      const jsonData = JSON.parse(proxyResponse.data);
      
      // Add debug information for ALL endpoints when debug=true
      if (isDebug) {
        const debugInfo = {
          _debug: {
            originalPath: apiPath,
            responseStatus: proxyResponse.status,
            dataLength: proxyResponse.data.length,
            endpointType: getEndpointType(apiPath),
            keys: Array.isArray(jsonData) ? ['array'] : Object.keys(jsonData),
            dataStructure: analyzeDataStructure(jsonData),
            dataPreview: proxyResponse.data.substring(0, 500)
          },
          ...jsonData
        };
        res.json(debugInfo);
      } else {
        res.json(jsonData);
      }
    } catch (parseError) {
      // Return parse error info in response
      if (isDebug) {
        await edgeLog('warn', `⚠️ Failed to parse JSON response from 1inch API for ${apiPath}`, {
          parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
          rawDataPreview: proxyResponse.data.substring(0, 200),
        });
      }
      res.status(500).json({
        error: 'JSON parse failed',
        parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        rawData: proxyResponse.data.substring(0, 500),
        path: apiPath,
        originalStatus: proxyResponse.status
      });
    }

  } catch (error) {
    console.error('❌ Vercel proxy error:', error);
    const isDebug = req.query.debug === 'true' || true; // Use same debug flag
    if (isDebug) {
      await edgeLog('error', `❌ Request failed for ${req.url}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        url: req.url,
        method: req.method
      });
      
      if (error instanceof Error && error.message.includes('timeout')) {
        await edgeLog('warn', '⚠️ Request timed out - 1inch API may be slow or unavailable');
      }
      if (error instanceof Error && error.message.includes('ENOTFOUND')) {
        await edgeLog('warn', '⚠️ DNS resolution failed - network connectivity issue');
      }
    }
    res.status(500).json({ 
      error: 'Proxy request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
