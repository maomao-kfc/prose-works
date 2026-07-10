// functions/api/count.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.pathname.replace('/api/count/', ''); // 获取路径中的 key

  // 只允许以 'prose-' 开头的 key
  if (!key || !key.startsWith('prose-')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 处理 CORS（如果需要跨域，这里同域其实不需要，但保留无妨）
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // GET 获取计数
  if (request.method === 'GET') {
    const value = await env.VISIT_COUNTER.get(key);
    const count = value ? parseInt(value, 10) : 0;
    return new Response(JSON.stringify({ count }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // POST 递增计数
  if (request.method === 'POST') {
    const oldValue = await env.VISIT_COUNTER.get(key);
    const newCount = (oldValue ? parseInt(oldValue, 10) : 0) + 1;
    await env.VISIT_COUNTER.put(key, String(newCount));
    return new Response(JSON.stringify({ count: newCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method Not Allowed', { status: 405 });
}