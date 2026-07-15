// ============================================================================
// 访客足迹日志 API
// 路由：/api/visit-log
// 数据存储：Cloudflare KV（绑定变量名 VISIT_COUNTER）
//
// 【重要优化】数据存储方式已从"单键全量"改为"按访客 ID 分片"：
//   旧版：所有访客数据存为 1 个 KV key（visitor-logs），JSON 数组
//         问题：① 并发写入互相覆盖 ② 数组无限增长会超 KV 25MB 限制
//   新版：每个访客独立 1 个 KV key（visitor:visitor-xxxx），只存自己的记录
//         优势：① 并发写入互不影响 ② 单条记录极小，不会超限
//
// 支持的操作：
//   POST ?action=add&vid=xxx&type=enter    → 进入页面（访问次数 +1）
//   POST ?action=add&vid=xxx&type=leave    → 离开页面（计算停留时长）
//   POST ?action=add&vid=xxx&type=heartbeat → 心跳（仅更新活跃时间）
//   GET  ?action=query&token=xxx           → 查询所有访客记录（需口令）
// ============================================================================

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // ---- CORS 安全限制（新增优化）----
  // 与 count API 相同的白名单机制，只允许自有域名跨域调用
  // 旧版 Access-Control-Allow-Origin: * 有被第三方网站窃取数据的风险
  const allowedOrigins = [
    'https://prose-works.pages.dev',  // 生产环境
    'http://localhost:8788'            // 本地开发
  ];
  const origin = request.headers.get('Origin') || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 从 URL 查询参数中提取操作类型、访客 ID、事件类型
  const action = url.searchParams.get('action');     // 'add' 或 'query'
  const visitorId = url.searchParams.get('vid');      // 匿名访客 ID，如 'visitor-abc123'
  const type = url.searchParams.get('type');          // 'enter' / 'leave' / 'heartbeat'

  // ================================================================
  // 添加或更新访客日志（enter / leave / heartbeat）
  // ================================================================
  if (request.method === 'POST' || action === 'add') {
    // 参数校验：vid 和 type 缺一不可
    if (!visitorId || !type) {
      return new Response(JSON.stringify({ error: 'Missing vid or type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const now = Date.now();

    // 【分片存储核心】每个访客使用独立的 KV key
    // 旧版：所有数据塞进一个 "visitor-logs" key
    // 新版：每个访客一个 "visitor:visitor-xxxx" key
    // 这样每次写入只影响自己的记录，不会覆盖其他访客的数据
    const kvKey = `visitor:${visitorId}`;
    const raw = await env.VISIT_COUNTER.get(kvKey);
    let record;

    // 【新增优化】JSON.parse 加 try-catch 保护
    // 旧版：直接 JSON.parse(raw)，如果 KV 数据损坏会导致整个 API 返回 500
    // 新版：解析失败时将 record 置为 null，后续逻辑会创建新记录
    try {
      record = raw ? JSON.parse(raw) : null;
    } catch (e) {
      record = null; // 数据损坏时当作新访客处理
    }

    // ---- type=enter：访客进入页面 ----
    // 老访客：访问次数 +1，更新进入时间
    // 新访客：创建完整记录，visits 初始为 1
    if (type === 'enter') {
      if (record) {
        record.visits = (record.visits || 0) + 1;
        record.lastEnter = now;
      } else {
        record = {
          vid: visitorId,
          visits: 1,
          firstVisit: now,
          lastEnter: now,
          lastLeave: now,
          totalDuration: 0
        };
      }
    // ---- type=leave：访客离开页面 ----
    // 计算本次停留时长 = 当前时间 - 上次进入时间
    // 累加到 totalDuration（总停留时长）
    } else if (type === 'leave') {
      if (record) {
        const duration = Math.max(0, now - record.lastEnter);
        record.lastLeave = now;
        record.totalDuration = (record.totalDuration || 0) + duration;
      } else {
        // 极端情况：leave 信号先于 enter 到达（如页面缓存导致顺序错乱）
        // 创建一条占位记录，visits=0 表示未正式计入访问次数
        record = {
          vid: visitorId,
          visits: 0,
          firstVisit: now,
          lastEnter: now,
          lastLeave: now,
          totalDuration: 0
        };
      }
    // ---- type=heartbeat：心跳保活 ----
    // 每 30 秒发送一次，仅更新 lastHeartbeat 字段
    // 不增加 visits 计数，不更新 lastEnter/lastLeave
    // 用途：判断访客是否仍在线（lastHeartbeat 超过一定时间 = 已离开）
    } else if (type === 'heartbeat') {
      if (record) {
        record.lastHeartbeat = now;
      }
      // 心跳时若记录不存在则忽略，不创建新记录
      // 避免仅因心跳就创建出 visits=0 的无效记录
    }

    // 只有 record 有值时才写入 KV（heartbeat 时 record 可能为 null）
    if (record) {
      await env.VISIT_COUNTER.put(kvKey, JSON.stringify(record));
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // ================================================================
  // 查询所有访客日志（需口令验证）
  // ================================================================
  if (request.method === 'GET' && action === 'query') {
    // 【新增优化】口令从环境变量读取，不再硬编码
    // 旧版：token !== 'ILoveBeimang'（口令写死在代码里，不安全）
    // 新版：优先读取 env.ADMIN_TOKEN 环境变量，未设置则降级为默认口令
    // 配置方式：Cloudflare Pages → Settings → Environment variables → 添加 ADMIN_TOKEN
    const token = url.searchParams.get('token');
    const validToken = env.ADMIN_TOKEN || 'ILoveBeimang';
    if (token !== validToken) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 【分片查询】遍历所有 visitor: 前缀的 KV key，汇总所有访客记录
    // 旧版：直接读取一个 visitor-logs key，一次 get 搞定
    // 新版：需要用 KV.list() 分页遍历所有 visitor:* key，逐个读取
    // KV.list() 每次最多返回 1000 个 key，超过需要用 cursor 分页
    const allRecords = [];
    let cursor = undefined;
    do {
      const listResult = await env.VISIT_COUNTER.list({
        prefix: 'visitor:',   // 只列出 visitor: 开头的 key
        cursor: cursor        // 分页游标，undefined 表示第一页
      });
      // 逐个读取每条访客记录
      for (const key of listResult.keys) {
        const raw = await env.VISIT_COUNTER.get(key.name);
        try {
          const record = JSON.parse(raw);
          if (record) allRecords.push(record);
        } catch (e) {
          // 跳过损坏的数据，不影响其他记录的返回
        }
      }
      // list_complete=true 表示已遍历完毕，cursor 为下一页的游标
      cursor = listResult.list_complete ? undefined : listResult.cursor;
    } while (cursor);

    // 按最后活跃时间倒序排列（最近活跃的排最前）
    // 优先用 lastLeave，没有则用 lastHeartbeat
    allRecords.sort((a, b) => (b.lastLeave || b.lastHeartbeat || 0) - (a.lastLeave || a.lastHeartbeat || 0));

    return new Response(JSON.stringify(allRecords), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 其他 HTTP 方法一律拒绝
  return new Response('Method Not Allowed', { status: 405 });
}