// 默认平台名称（可根据需要修改）
const DEFAULT_PROVIDER = 'groq';

// LLM service endpoint mappings
const LLM_ENDPOINTS = {
  'openai': 'https://api.openai.com',
  'anthropic': 'https://api.anthropic.com',
  'gemini': 'https://generativelanguage.googleapis.com',
  'groq': 'https://api.groq.com/openai',
  'sambanova': 'https://api.sambanova.ai',
  'azure': 'https://YOUR_AZURE_RESOURCE_NAME.openai.azure.com', // 需要替换为实际的Azure资源名
  'cerebras': 'https://cloud.cerebras.ai/',
  
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    console.log(`Incoming request to: ${request.url}`);
    
    if (request.method === 'OPTIONS') {
        console.log('Handling CORS preflight request');
        return handleCORS(request);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(part => part);
    
    let provider;
    let newPathname;

    // 检查路径是否指定了提供商
    if (pathParts.length > 0 && LLM_ENDPOINTS[pathParts[0]]) {
        // 路径中明确指定了提供商
        provider = pathParts[0];
        newPathname = '/' + pathParts.slice(1).join('/');
    } else {
        // 路径中未指定提供商，使用默认平台
        provider = DEFAULT_PROVIDER;
        newPathname = '/' + pathParts.join('/'); // 保留原始路径
        console.log(`No provider specified, using default provider: ${provider}`);
    }

    const targetEndpoint = LLM_ENDPOINTS[provider];
    console.log(`Proxying request to ${provider} at ${targetEndpoint}`);
    
    const targetUrl = new URL(targetEndpoint);
    const endpointPath = targetUrl.pathname;
    
    // 修改URL拼接逻辑
    if (endpointPath === '/') {
        // 如果endpoint没有路径,直接使用新路径
        targetUrl.pathname = newPathname;
    } else {
        // 如果endpoint有路径(如groq的/openai),需要特殊处理
        if (provider === DEFAULT_PROVIDER && !pathParts[0]?.includes(provider)) {
            // 直接域名访问且是默认provider(groq),需要保留endpoint路径
            targetUrl.pathname = endpointPath.replace(/\/$/, '') + '/' + newPathname.replace(/^\//, '');
        } else {
            // 带平台访问或非默认provider,使用标准拼接
            targetUrl.pathname = endpointPath.replace(/\/$/, '') + '/' + newPathname.replace(/^\//, '');
        }
    }
    
    targetUrl.search = url.search;
    
    const cleanedHeaders = new Headers();
    for (const [key, value] of request.headers) {
        if (!key.toLowerCase().startsWith('cf-') && 
            !['x-real-ip', 'x-forwarded-for', 'x-forwarded-proto', 
              'x-forwarded-host', 'x-forwarded-port', 'x-forwarded-scheme',
              'x-forwarded-ssl', 'cdn-loop'].includes(key.toLowerCase())) {
            cleanedHeaders.set(key, value);
        }
    }
    
    const modifiedRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers: cleanedHeaders,
        body: request.body,
        redirect: 'follow'
    });
    
    try {
        console.log('Forwarding request with cleaned headers:', 
                    JSON.stringify(Object.fromEntries(cleanedHeaders.entries()), null, 2));
        const response = await fetch(modifiedRequest);
        console.log(`Response received with status: ${response.status}`);
        
        const modifiedResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });
        
        modifiedResponse.headers.set('Access-Control-Allow-Origin', request.headers.get('Origin') || '*');
        modifiedResponse.headers.set('Access-Control-Allow-Credentials', 'true');
        
        return modifiedResponse;
    } catch (error) {
        console.error(`Error proxying request to ${provider}:`, error);
        return new Response(`Error proxying request to ${provider}: ${error.message}`, { status: 500 });
    }
}

function handleCORS(request) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
    };
    
    return new Response(null, {
        status: 204,
        headers: corsHeaders
    });
}
