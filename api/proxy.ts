/**
 * 1inch API proxy utilities for Vercel API routes
 * Contains shared logic for handling 1inch API requests
 */

export interface ProxyRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string | string[]>;
}

export interface ProxyResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: string;
}

/**
 * Core 1inch API proxy logic
 */
export async function proxyToOneInch(
  request: ProxyRequest,
  apiKey: string,
  options: {
    baseUrl?: string;
    logPrefix?: string;
  } = {}
): Promise<ProxyResponse> {
  const { baseUrl = 'https://api.1inch.dev', logPrefix = '🔗' } = options;
  
  // Extract path from request URL (remove /api/1inch prefix)
  const path = request.url.replace(/^\/api\/1inch\/?/, '');
  
  // Build the full 1inch API URL
  const apiUrl = `${baseUrl}/${path}`;
  const url = new URL(apiUrl);
  
  // Add query parameters
  if (request.query) {
    Object.entries(request.query).forEach(([key, value]) => {
      if (value) {
        const paramValue = Array.isArray(value) ? value[0] : value;
        url.searchParams.append(key, paramValue);
      }
    });
  }

  console.log(`${logPrefix} Proxying ${request.method} request to: ${url.toString()}`);
  console.log(`🔑 Using API key: ${apiKey.substring(0, 8)}...`);
  console.log(`🔍 DEBUG: Full URL breakdown:`, {
    baseUrl,
    path,
    fullUrl: url.toString(),
    searchParams: Object.fromEntries(url.searchParams),
    method: request.method
  });

  try {
    // Make the request to 1inch API with robust headers for edge compatibility
    const response = await fetch(url.toString(), {
      method: request.method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'uniter.sh/1.0 (https://uniter.sh)',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        ...request.headers,
      },
      body: request.method !== 'GET' && request.body ? JSON.stringify(request.body) : undefined,
    });

    console.log(`📡 1inch API response: ${response.status} ${response.statusText}`);
    
    // Get response data
    const data = await response.text();
    
    // Get response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Log response details
    if (response.status >= 400) {
      console.error(`❌ 1inch API error response:`, {
        status: response.status,
        statusText: response.statusText,
        url: url.toString(),
        method: request.method,
        responseData: data.substring(0, 200)
      });
    } else {
      console.log(`✅ 1inch API success: ${data.length} bytes received`);
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data
    };

  } catch (error) {
    console.error(`🔥 Proxy error:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      url: url.toString(),
      method: request.method,
      timestamp: new Date().toISOString()
    });
    
    throw error;
  }
}
