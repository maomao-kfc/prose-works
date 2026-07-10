// functions/api/count/[key].js
export async function onRequest(context) {
  const { request, env, params } = context;
  const key = params.key; // 从动态路由参数中获取 key

  // 只允许非空 key
  if (!key) {
    return new Response(JSON.stringify({ error: 'Key is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method === 'GET') {
    const value = await env.VISIT_COUNTER.get(key);
    const count = value ? parseInt(value, 10) : 0;
    return new Response(JSON.stringify({ count }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

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