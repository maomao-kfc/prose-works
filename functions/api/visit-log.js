export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // 处理 CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 获取当前所有日志
  const LOGS_KEY = 'visitor-logs';
  const raw = await env.VISIT_COUNTER.get(LOGS_KEY);
  let logs = raw ? JSON.parse(raw) : [];

  // 查询参数
  const action = url.searchParams.get('action');     // 'add' 或 'query'
  const visitorId = url.searchParams.get('vid');     // 访客匿名 ID
  const type = url.searchParams.get('type');         // 'enter' 或 'leave'

  // 添加日志
  if (request.method === 'POST' || action === 'add') {
    if (!visitorId) {
      return new Response(JSON.stringify({ error: 'Missing vid' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const now = Date.now();
    const existing = logs.find(l => l.vid === visitorId);

    if (type === 'enter') {
      if (existing) {
        // 更新访问次数和进入时间
        existing.visits = (existing.visits || 1) + 1;
        existing.lastEnter = now;
        existing.lastLeave = existing.lastLeave || now; // 初始值
      } else {
        logs.push({
          vid: visitorId,
          visits: 1,
          firstVisit: now,
          lastEnter: now,
          lastLeave: now,
          totalDuration: 0
        });
      }
    } else if (type === 'leave') {
      if (existing) {
        const duration = Math.max(0, now - existing.lastEnter);
        existing.lastLeave = now;
        existing.totalDuration = (existing.totalDuration || 0) + duration;
      }
    }

    // 保存回 KV
    await env.VISIT_COUNTER.put(LOGS_KEY, JSON.stringify(logs));
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // 查询日志（可携带密码保护）
  if (request.method === 'GET' && action === 'query') {
    const token = url.searchParams.get('token');
    // 设置一个只有你知道的简单口令，防止别人查看
    if (token !== 'ILoveBeimang') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 返回日志，并按最后访问时间降序
    logs.sort((a, b) => b.lastLeave - a.lastLeave);
    return new Response(JSON.stringify(logs), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response('Method Not Allowed', { status: 405 });
}