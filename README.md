# 《北邙山》散文网站

一个承载个人散文的静态网页，部署于 Cloudflare Pages，具备访问计数、访客足迹、反爬保护、重置口令验证等功能。

## 🌐 访问地址

- **散文主页**：`https://prose-works.pages.dev`
- **足迹查看（需口令）**：`https://prose-works.pages.dev/footprints.html?token=你的口令`
- **重置计数器**：`https://prose-works.pages.dev/reset.html`

## 📁 项目结构

```
/
├── index.html              # 散文主页（含计数、反爬、足迹脚本）
├── index2.html             # 散文主页旧版备份（不蒜子计数、有水印、无足迹）
├── reset.html              # 计数器重置工具页（需口令验证）
├── footprints.html         # 访客足迹展示页（需口令）
├── functions/
│   └── api/
│       ├── count/
│       │   └── [key].js    # 计数器 API (GET/POST/DELETE + CORS 白名单)
│       └── visit-log.js    # 访客日志 API (分片存储、口令验证、心跳)
├── README.md
└── .gitignore
```

## 🚀 部署指南

1. 将本项目推送到 GitHub 仓库。
2. 在 Cloudflare Pages 中连接该仓库。
3. 构建设置：
   - **构建命令**：留空
   - **输出目录**：`/`
4. 部署完成后，在 Pages 项目 **Settings → Functions → KV namespace bindings** 中绑定一个 KV 命名空间，变量名为 `VISIT_COUNTER`。
5. 配置管理口令（见下方 👇）。
6. 重新部署，使 Functions 生效。

---

## � 管理口令 `ADMIN_TOKEN`

### 为什么需要？

为了安全，`reset.html`（重置计数）和 `footprints.html`（查看访客足迹）都需要输入口令才能进入。口令不再硬编码在代码中，改为从 **环境变量** 读取。

### 配置步骤

1. 登录 Cloudflare 控制台 → 进入你的 Pages 项目 → **Settings → Environment variables**。
2. 点击 **+ Add** 添加一个 **Secret** 类型的变量：
   - **Name**：`ADMIN_TOKEN`
   - **Value**：你自己设定的口令（建议 12 位以上、包含大小写字母和数字）
3. 保存后 **重新部署**（Deploy）项目，新变量才会生效。

### 使用方式

- `footprints.html?token=你设定的口令` → 查看访客足迹
- `reset.html` → 输入口令 → 验证通过后显示重置按钮

### 降级说明

如果没有配置 `ADMIN_TOKEN`，API 会回退到默认口令 `ILoveBeimang`。**生产环境强烈建议配置自己的 `ADMIN_TOKEN`。**

---

## � 计数器功能

### 计数逻辑
- 页面首次加载时自动递增总访问人数（通过 `POST /api/count/prose-beimang`）。
- 同一浏览器通过 **Cookie (`hasVisited_v7`)** 和 **localStorage** 双重去重，365 天内不重复计数。
- 总计数存储在 Cloudflare KV 中，全局共享。
- 支持防缓存：每次 GET 请求携带随机参数，避免浏览器缓存旧数字。
- **CORS 白名单**：只允许 `prose-works.pages.dev` 和 `localhost:8788` 调用（生产环境请按需调整）。

### 重置计数
- 打开 `reset.html` → 输入管理口令 → 点击按钮即可清零。
- 也可在 Cloudflare 仪表板 → KV 中手动删除 `prose-beimang` 键。

### 自定义计数器 Key
在 `index.html` 中修改 `VISIT_KEY` 变量（如 `prose-beimang-v2`），即可从零开始新计数（旧数据保留）。

---

## 👣 访客足迹系统

### 记录内容
- 匿名访客 ID（随机生成，存储于 localStorage，不泄露隐私）
- 访问次数
- 总停留时长（毫秒）
- 最后活跃时间
- 首次访问时间

### 查看足迹
访问 `footprints.html?token=你的ADMIN_TOKEN`。

### 数据更新逻辑
- **进入页面**：发送 `type=enter`，访问次数 +1。
- **离开页面**：发送 `type=leave`，记录本次停留时长并累加到总时长。
- **每 30 秒心跳**：发送 `type=heartbeat`，仅更新最后活跃时间，不增加访问次数。

### 数据存储（分片存储）
- **旧版**：所有日志塞进一个 `visitor-logs` KV key，JSON 数组。问题：高并发覆盖、无限增长可能超 KV 25MB 限制。
- **新版**：每个访客使用独立的 KV key（`visitor:visitor-xxxx`），写入互不影响，单条记录极小不会超限。
- **查询方式**：使用 `KV.list({ prefix: 'visitor:' })` 分页遍历汇总，支持数千访客。

---

## 🛡️ 反爬保护

- 电脑端：禁止右键菜单、文本选择、拖拽、Ctrl+C/F12 等快捷键。
- 移动端：禁止长按弹出菜单，但不影响页面滚动。
- 如果需要暂时关闭保护，可在 `index.html` 和 `index2.html` 中将反爬脚本注释掉。

---

## 📊 其他统计

- **Cloudflare Web Analytics**：已内嵌于页面，匿名统计页面浏览量、国家、设备等信息（只统计 `index.html`，不统计 `index2.html`）。登录 Cloudflare 仪表板查看。
- **足迹系统**：可详细查看每位匿名访客的停留时长和访问次数，仅供作者本人通过密码查看。

---

## 🛠️ 常见配置

| 配置项 | 文件位置 | 说明 |
|--------|----------|------|
| 计数器 Key | `index.html` → `VISIT_KEY` | 更换以重置全局计数 |
| 去重 Cookie 名 | `index.html` → `COOKIE_NAME` | 更改可强制所有访客重新计数 |
| 去重有效期 | `index.html` → `setCookie` 的第三个参数 | 默认 365 天 |
| 管理口令 | Cloudflare Pages → Environment variables → `ADMIN_TOKEN` | **强烈建议设置** |
| 文章字数/作者 | `index.html` 底部 `.article-meta` | 直接编辑 HTML |
| 反爬开关 | `index.html` / `index2.html` 中反爬脚本部分 | 注释或取消注释 |
| CORS 白名单 | `functions/api/count/[key].js` 和 `visit-log.js` | 添加自定义域名 |

---

## 📖 本地开发

### 方式一：快速预览（无 API）
直接双击 `index.html` 用浏览器预览样式。计数器、足迹等 API 功能会导致网络报错，但不影响页面显示。

### 方式二：完整运行（含 API）

```bash
# 安装 wrangler（只需一次）
npm install -g wrangler

# 登录 Cloudflare（只需一次，会打开浏览器授权）
wrangler login

# 在项目根目录运行开发服务器（必须带 --kv 参数绑定 KV）
wrangler pages dev . --port 8788 --kv VISIT_COUNTER
```

终端会输出类似 `http://localhost:8788`，打开即可看到完整效果，计数器和足迹都能正常工作。

> 注意：本地开发时 `ADMIN_TOKEN` 环境变量需要单独配置，或使用默认口令 `ILoveBeimang`。

---

## ✅ 验证清单

部署后按以下步骤逐一验证，确保功能正常：

### 1. Cloudflare Dashboard 确认

| 检查项 | 位置 | 预期状态 |
|--------|------|----------|
| KV 绑定 | Settings → Functions → KV namespace bindings | `VISIT_COUNTER` 已绑定 |
| 管理口令 | Settings → Environment variables | `ADMIN_TOKEN` 已添加（Secret 类型） |

### 2. 接口验证（终端 curl）

先运行 `wrangler pages dev .`，另开终端执行：

```bash
# 计数器读取
curl "http://localhost:8788/api/count/prose-beimang?t=123456"
# 预期：{"count": N}

# 计数器 +1
curl -X POST "http://localhost:8788/api/count/prose-beimang"
# 预期：{"count": N+1}

# 足迹查询（替换为你的口令）
curl "http://localhost:8788/api/visit-log?action=query&token=你的口令"
# 预期：[] 或 [{"vid":"visitor-xxx","visits":1,...}]

# 足迹查询（错误口令）
curl "http://localhost:8788/api/visit-log?action=query&token=wrong"
# 预期：{"error":"Forbidden"}
```

### 3. 浏览器验证

| 操作 | 预期结果 |
|------|----------|
| 打开 `localhost:8788` | 页面正常显示，"已有 X 位朋友来过"有数字 |
| 刷新页面 | 数字不变（同一设备去重） |
| 无痕窗口打开 | 数字 +1（新设备） |
| 打开 `footprints.html?token=你的口令` | 显示访客表格 |
| 打开 `footprints.html?token=wrong` | 显示"无权限访问" |
| 打开 `reset.html` → 输入口令 → 重置 | 计数归零 |

---

## 📄 许可

原创稿件，未经许可请勿转载。

---

> 写于 2026 年，致青春，致所有曾在时光里留下印记的人。