// LLM服务端点映射
const LLM_ENDPOINTS = {
  'openai': 'https://api.openai.com',
  'anthropic': 'https://api.anthropic.com',
  'gemini': 'https://generativelanguage.googleapis.com',
  'groq': 'https://api.groq.com/openai',
  'sambanova': 'https://api.sambanova.ai',
  'azure': 'https://YOUR_AZURE_RESOURCE_NAME.openai.azure.com', // 需要替换为实际的Azure资源名
  'cerebras': 'https://cloud.cerebras.ai/',
  // Add more providers as needed
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  console.log(`收到请求: ${request.method} ${request.url}`);

  // 处理CORS预检请求
  if (request.method === 'OPTIONS') {
    return handleCORS(request);
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(part => part);

  // 检查路径中是否包含有效的LLM提供商
  if (pathParts.length > 0 && LLM_ENDPOINTS[pathParts[0]]) {
    const provider = pathParts[0];
    const targetBaseUrl = LLM_ENDPOINTS[provider];
    
    // 构建目标URL
    const remainingPath = pathParts.slice(1).join('/');
    const finalTargetUrl = `${targetBaseUrl.replace(/\/$/, '')}/${remainingPath}${url.search}`;

    // 清理并构建新的请求头
    const cleanedHeaders = new Headers();
    for (const [key, value] of request.headers) {
      const lowerKey = key.toLowerCase();
      if (!lowerKey.startsWith('cf-') && 
          !['host', 'x-real-ip', 'x-forwarded-for', 'x-forwarded-proto',
            'x-forwarded-host', 'x-forwarded-port', 'x-forwarded-scheme',
            'x-forwarded-ssl', 'cdn-loop'].includes(lowerKey)) {
        cleanedHeaders.set(key, value);
      }
    }

    // 保留Content-Type
    if (request.headers.has('Content-Type')) {
      cleanedHeaders.set('Content-Type', request.headers.get('Content-Type'));
    }

    // 构建新的请求
    const modifiedRequest = new Request(finalTargetUrl, {
      method: request.method,
      headers: cleanedHeaders,
      body: request.body,
      redirect: 'follow'
    });

    try {
      // 转发请求到目标API
      const response = await fetch(modifiedRequest);
      
      // 构建响应
      const modifiedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers)
      });

      // 添加CORS头
      modifiedResponse.headers.set('Access-Control-Allow-Origin', request.headers.get('Origin') || '*');
      modifiedResponse.headers.set('Access-Control-Allow-Credentials', 'true');

      // 移除Cloudflare相关头部
      for (const [key] of modifiedResponse.headers) {
        if (key.toLowerCase().startsWith('cf-')) {
          modifiedResponse.headers.delete(key);
        }
      }

      return modifiedResponse;
    } catch (error) {
      console.error(`代理请求到${provider}时出错:`, error);
      return new Response(`代理请求到${provider}失败: ${error.message}`, { status: 502 });
    }
  }

  return new Response(
    `无效的LLM提供商路径。请使用 /provider/api/path 格式。可用提供商: ${Object.keys(LLM_ENDPOINTS).join(', ')}`, 
    { status: 400 }
  );
}

function handleCORS(request) {
  // 处理CORS预检请求
  const corsHeaders = {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 
                                  'Content-Type, Authorization, Accept, Cache-Control, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400' // 预检请求缓存1天
  };

  return new Response(null, { status: 204, headers: corsHeaders });
}
