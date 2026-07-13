export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const LOGS_KEY = 'visitor-logs';
  const raw = await env.VISIT_COUNTER.get(LOGS_KEY);
  let logs = raw ? JSON.parse(raw) : [];

  const action = url.searchParams.get('action');
  const visitorId = url.searchParams.get('vid');
  const type = url.searchParams.get('type');

  // 添加或更新日志
  if (request.method === 'POST' || action === 'add') {
    if (!visitorId || !type) {
      return new Response(JSON.stringify({ error: 'Missing vid or type' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const now = Date.now();
    let existing = logs.find(l => l.vid === visitorId);

    if (type === 'enter') {
      if (existing) {
        // 真实的进入才增加访问次数
        existing.visits = (existing.visits || 0) + 1;
        existing.lastEnter = now;
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
    } else if (type === 'heartbeat') {
      if (existing) {
        // 仅更新最后活跃时间，不增加 visits
        existing.lastHeartbeat = now;
      }
    }

    await env.VISIT_COUNTER.put(LOGS_KEY, JSON.stringify(logs));
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // 查询日志（带密码保护）
  if (request.method === 'GET' && action === 'query') {
    const token = url.searchParams.get('token');
    if (token !== 'ILoveBeimang') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    logs.sort((a, b) => b.lastLeave - a.lastLeave);
    return new Response(JSON.stringify(logs), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response('Method Not Allowed', { status: 405 });
}