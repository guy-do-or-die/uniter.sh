export const config = {
    runtime: 'edge',
};

export default async function handler(req: Request) {
    try {
        const url = new URL(req.url);
        
        // Extract the API path from the URL pathname
        // The URL will be like: /api/1inch/token/v1.3/130/search
        // We want to extract: /token/v1.3/130/search
        const fullPath = url.pathname;
        const apiPath = fullPath.replace('/api/1inch', '') || '/';
        
        // Build the 1inch API URL
        const oneinchUrl = `https://api.1inch.dev${apiPath}${url.search}`;
        

        // Get API key from environment
        const apiKey = process.env.ONEINCH_API_KEY;
        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: 'API key not configured' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }
        
        // Forward the request to 1inch API
        const response = await fetch(oneinchUrl, {
            method: req.method,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: req.method !== 'GET' ? await req.text() : undefined,
        });
        
        // Get response data
        const data = await response.text();
        
        // Return the response with CORS headers
        return new Response(data, {
            status: response.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
        
    } catch (error) {
        console.error('API proxy error:', error);
        return new Response(
            JSON.stringify({ 
                error: 'API request failed',
                details: error instanceof Error ? error.message : String(error)
            }),
            { 
                status: 500, 
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                }
            }
        );
    }
}