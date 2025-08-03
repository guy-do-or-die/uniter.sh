import { VercelRequest, VercelResponse } from '@vercel/node';
import { proxyToOneInch, ProxyRequest } from './proxy.js';

// Edge-compatible logging function
async function logToWebhook(level: string, message: string, data?: any) {
  const webhookUrl = process.env.DEBUG_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log(`[${level}] ${message}`, data || '');
    return;
  }

  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data || null,
      environment: 'vercel-edge',
      requestId: Math.random().toString(36).substring(7)
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry)
    });
  } catch (error) {
    // Fail silently to avoid disrupting main flow
    console.log(`[${level}] ${message}`, data || '');
  }
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

function getStatusText(statusCode: number): string {
  switch (statusCode) {
    case 200:
      return 'OK';
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 500:
      return 'Internal Server Error';
    default:
      return 'Unknown Status Code';
  }
}

/**
 * Vercel API route for 1inch proxy
 * Handles requests to /api/1inch with path parsing
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Request-ID', requestId);

  if (req.method === 'OPTIONS') {
    await logToWebhook('INFO', '🔄 CORS preflight request', { requestId });
    res.status(200).end();
    return;
  }

  try {
    // Hardcoded debug mode for testing
    const isDebug = true; // req.query.debug === 'true';
    
    await logToWebhook('INFO', '🚀 Request started', {
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
      referer: req.headers.referer,
      query: req.query,
      bodySize: req.body ? JSON.stringify(req.body).length : 0
    });

    // Validate API key
    const apiKey = process.env.ONEINCH_API_KEY;
    if (!apiKey) {
      await logToWebhook('ERROR', '❌ ONEINCH_API_KEY not found', { requestId });
      return res.status(500).json({ error: 'API key not configured', requestId });
    }
    
    await logToWebhook('INFO', '✅ API key validation', { 
      requestId,
      length: apiKey.length,
      prefix: apiKey.substring(0, 8) + '...',
      isValid: apiKey.length >= 32
    });

    // Parse the path
    const fullPath = req.url || '';
    const pathMatch = fullPath.match(/^\/api\/1inch\/(.+)$/);
    if (!pathMatch) {
      await logToWebhook('ERROR', '❌ Invalid path format', { 
        requestId,
        fullPath,
        expectedFormat: '/api/1inch/{path}'
      });
      return res.status(400).json({ error: 'Invalid path format', receivedUrl: fullPath, requestId });
    }
    const apiPath = pathMatch[1];
    
    await logToWebhook('INFO', '🔗 Path parsing successful', { 
      requestId,
      apiPath, 
      fullPath,
      pathLength: apiPath.length,
      hasVersion: apiPath.includes('/v1.'),
      endpointType: getEndpointType(apiPath)
    });

    // Normalize query parameters for consistent edge/dev handling
    const normalizedQuery: Record<string, string | string[]> = {};
    if (req.query) {
      Object.entries(req.query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          // Ensure consistent string conversion for edge compatibility
          normalizedQuery[key] = Array.isArray(value) ? value.map(String) : String(value);
        }
      });
    }

    // Proxy request to 1inch API
    const proxyRequest: ProxyRequest = {
      url: fullPath,
      method: req.method || 'GET',
      body: req.body,
      query: normalizedQuery
    };
    
    await logToWebhook('INFO', '📡 Initiating 1inch API request', {
      requestId,
      method: proxyRequest.method,
      path: apiPath,
      hasBody: !!proxyRequest.body,
      queryParams: Object.keys(req.query || {}),
      queryCount: Object.keys(req.query || {}).length,
      fullQueryObject: req.query,
      reconstructedUrl: `https://api.1inch.dev/${apiPath}`,
      environment: 'production',
      region: process.env.VERCEL_REGION || 'unknown',
      nodeVersion: process.version,
      runtime: 'vercel-edge',
      timestamp: new Date().toISOString(),
      isSearchRequest: apiPath.includes('/search'),
      queryValue: req.query?.query,
      fullRequestUrl: req.url,
      userAgent: req.headers['user-agent'],
      referer: req.headers.referer,
      origin: req.headers.origin
    });
    
    const proxyStartTime = Date.now();
    const proxyResponse = await proxyToOneInch(proxyRequest, apiKey, { logPrefix: '🚀 Vercel' });
    const proxyDuration = Date.now() - proxyStartTime;
    
    await logToWebhook('INFO', '📥 1inch API response received', {
      requestId,
      status: proxyResponse.status,
      statusText: getStatusText(proxyResponse.status),
      dataLength: proxyResponse.data.length,
      duration: `${proxyDuration}ms`,
      contentType: proxyResponse.headers['content-type'],
      dataPreview: proxyResponse.data.substring(0, 300),
      isJson: proxyResponse.headers['content-type']?.includes('application/json'),
      isEmpty: proxyResponse.data.length === 0
    });

    // Set response headers with debug info
    res.status(proxyResponse.status);
    res.setHeader('Content-Type', proxyResponse.headers['content-type'] || 'application/json');
    res.setHeader('X-Debug-Status', proxyResponse.status.toString());
    res.setHeader('X-Debug-Length', proxyResponse.data.length.toString());
    res.setHeader('X-Debug-Path', apiPath);
    res.setHeader('X-Debug-Endpoint-Type', getEndpointType(apiPath));
    res.setHeader('X-Debug-Duration', `${proxyDuration}ms`);
    res.setHeader('X-Debug-Request-ID', requestId);

    await logToWebhook('INFO', '🔄 Setting response headers and processing data', {
      requestId,
      responseStatus: proxyResponse.status,
      contentType: proxyResponse.headers['content-type'],
      willAttemptJsonParse: proxyResponse.headers['content-type']?.includes('json') || proxyResponse.data.trim().startsWith('{') || proxyResponse.data.trim().startsWith('[')
    });

    // Try parse JSON response
    try {
      const jsonData = JSON.parse(proxyResponse.data);
      
      await logToWebhook('INFO', '✅ JSON parsing successful', {
        requestId,
        dataType: Array.isArray(jsonData) ? 'array' : typeof jsonData,
        keys: Array.isArray(jsonData) ? jsonData.length : Object.keys(jsonData || {}).length,
        structure: analyzeDataStructure(jsonData)
      });
      
      if (isDebug) {
        const debugInfo = {
          _debug: {
            requestId,
            originalPath: apiPath,
            responseStatus: proxyResponse.status,
            dataLength: proxyResponse.data.length,
            endpointType: getEndpointType(apiPath),
            keys: Array.isArray(jsonData) ? ['array'] : Object.keys(jsonData),
            dataStructure: analyzeDataStructure(jsonData),
            dataPreview: proxyResponse.data.substring(0, 500),
            totalDuration: `${Date.now() - startTime}ms`,
            proxyDuration: `${proxyDuration}ms`
          },
          ...jsonData
        };
        
        await logToWebhook('INFO', '📤 Sending debug response', {
          requestId,
          hasDebugInfo: true,
          totalKeys: Object.keys(debugInfo).length
        });
        
        res.json(debugInfo);
      } else {
        await logToWebhook('INFO', '📤 Sending production response', {
          requestId,
          hasDebugInfo: false
        });
        res.json(jsonData);
      }
    } catch (parseError) {
      await logToWebhook('ERROR', '❌ JSON parse failed', {
        requestId,
        path: apiPath,
        parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        dataPreview: proxyResponse.data.substring(0, 300),
        originalStatus: proxyResponse.status,
        dataLength: proxyResponse.data.length,
        contentType: proxyResponse.headers['content-type'],
        startsWithBrace: proxyResponse.data.trim().startsWith('{'),
        startsWithBracket: proxyResponse.data.trim().startsWith('[')
      });
      
      res.status(500).json({ 
        error: 'JSON parse failed', 
        parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error', 
        rawData: proxyResponse.data.substring(0, 500), 
        path: apiPath, 
        originalStatus: proxyResponse.status,
        requestId
      });
    }

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    
    await logToWebhook('ERROR', '❌ Vercel proxy error', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack?.substring(0, 1000) : undefined,
      url: req.url,
      method: req.method,
      totalDuration: `${totalDuration}ms`,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      isTimeout: error instanceof Error && error.message.includes('timeout'),
      isDNSError: error instanceof Error && error.message.includes('ENOTFOUND'),
      isNetworkError: error instanceof Error && (error.message.includes('fetch') || error.message.includes('network'))
    });
    
    console.error('❌ Vercel proxy error:', error);
    res.status(500).json({ 
      error: 'Proxy request failed', 
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      duration: `${totalDuration}ms`
    });
  }
}
