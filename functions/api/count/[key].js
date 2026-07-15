// ============================================================================
// 访问计数器 API
// 路由：/api/count/:key  （Cloudflare Pages Functions 动态路由）
// 数据存储：Cloudflare KV（绑定变量名 VISIT_COUNTER）
// 支持 GET（读取）、POST（+1）、DELETE（归零）、OPTIONS（CORS 预检）
// ============================================================================

export async function onRequest(context) {
  // context 由 Cloudflare Pages Functions 自动注入，包含：
  // - request：原始 Request 对象
  // - env：环境变量 + KV 绑定
  // - params：动态路由参数（如 /api/count/prose-beimang 中的 key = "prose-beimang"）
  const { request, env, params } = context;
  const key = params.key; // 从 URL 路径中提取计数器 key，如 "prose-beimang"

  // 只允许非空 key，防止误调用 /api/count/ 无效路径
  if (!key) {
    return new Response(JSON.stringify({ error: 'Key is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ---- CORS 安全限制（新增优化）----
  // 旧版：Access-Control-Allow-Origin: *（允许任意网站调用，有被恶意刷量风险）
  // 新版：只允许白名单内的域名调用，其他域名请求会被浏览器拦截
  // 如需添加自定义域名，在此数组中追加即可
  const allowedOrigins = [
    'https://prose-works.pages.dev',  // 生产环境域名
    'http://localhost:8788'            // 本地开发用（wrangler dev 默认端口）
  ];
  // 从请求头中获取 Origin，判断是否在白名单内
  // 在白名单内 → 返回该 Origin（精确匹配，浏览器才允许跨域）
  // 不在白名单内 → 返回默认的第一个域名（浏览器会拦截响应）
  const origin = request.headers.get('Origin') || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    // 新增 DELETE 方法支持（旧版只有 GET, POST, OPTIONS）
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // 处理 CORS 预检请求（浏览器跨域请求前会先发 OPTIONS 探测）
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ---- GET：读取当前计数值 ----
  // 从 KV 中读取 key 对应的值，不存在则返回 0
  if (request.method === 'GET') {
    const value = await env.VISIT_COUNTER.get(key);
    const count = value ? parseInt(value, 10) : 0;
    return new Response(JSON.stringify({ count }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // ---- POST：计数 +1 ----
  // 读取旧值 → 加 1 → 写回 KV → 返回新值
  // 注意：KV 不支持原子 increment，高并发下可能有少量计数丢失
  // 对于个人散文站点的访问量级，这个误差可以接受
  if (request.method === 'POST') {
    const oldValue = await env.VISIT_COUNTER.get(key);
    const newCount = (oldValue ? parseInt(oldValue, 10) : 0) + 1;
    await env.VISIT_COUNTER.put(key, String(newCount));
    return new Response(JSON.stringify({ count: newCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // ---- DELETE：重置计数为 0 ----
  // 用于 reset.html 管理页面归零计数器
  if (request.method === 'DELETE') {
      await env.VISIT_COUNTER.put(key, '0');
      return new Response(JSON.stringify({ count: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
  }
  
  // 其他 HTTP 方法一律拒绝
  return new Response('Method Not Allowed', { status: 405 });
}