# 《北邙山》散文网站

一个承载个人散文的静态网页，部署于 Cloudflare Pages，具备访问计数、访客足迹、反爬保护等功能。

## 🌐 访问地址

- **散文主页**：`https://prose-works.pages.dev`
- **足迹查看（需口令）**：`https://prose-works.pages.dev/footprints.html?token=ILoveBeimang`
- **重置计数器**：`https://prose-works.pages.dev/reset.html`

## 📁 项目结构
/
├── index.html # 散文主页（含计数、反爬、足迹脚本）
├── reset.html # 计数器重置工具页
├── footprints.html # 访客足迹展示页
├── functions/
│ └── api/
│ ├── count/
│ │ └── [key].js # 计数器 API (GET/POST/DELETE)
│ └── visit-log.js # 访客日志 API (记录进入/离开/心跳)
├── README.md
└── .gitignore

text

## 🚀 部署指南

1. 将本项目推送到 GitHub 仓库。
2. 在 Cloudflare Pages 中连接该仓库。
3. 构建设置：
   - **构建命令**：留空
   - **输出目录**：`/`
4. 部署完成后，在 Pages 项目 **Settings → Functions → KV namespace bindings** 中绑定一个 KV 命名空间，变量名为 `VISIT_COUNTER`。
5. 重新部署，使 Functions 生效。

## 🔢 计数器功能

### 计数逻辑
- 页面首次加载时自动递增总访问人数（通过 `POST /api/count/prose-beimang`）。
- 同一浏览器通过 **Cookie (`hasVisited_v7`)** 和 **localStorage** 双重去重，365 天内不重复计数。
- 总计数存储在 Cloudflare KV 中，全局共享。
- 支持防缓存：每次 GET 请求携带随机参数，避免浏览器缓存旧数字。

### 重置计数
- 打开 `reset.html`，点击按钮即可清零。
- 也可在 Cloudflare 仪表板 → KV 中手动删除 `prose-beimang` 键。

### 自定义计数器 Key
在 `index.html` 中修改 `VISIT_KEY` 变量（如 `prose-beimang-v2`），即可从零开始新计数（旧数据保留）。

## 👣 访客足迹系统

### 记录内容
- 匿名访客 ID（随机生成，存储于 localStorage，不泄露隐私）
- 访问次数
- 总停留时长（毫秒）
- 最后活跃时间
- 首次访问时间

### 查看足迹
访问 `footprints.html?token=ILoveBeimang`（默认口令）。  
可在 `functions/api/visit-log.js` 中修改口令。

### 数据更新逻辑
- **进入页面**：发送 `type=enter`，访问次数 +1。
- **离开页面**：发送 `type=leave`，记录本次停留时长并累加到总时长。
- **每 30 秒心跳**：发送 `type=heartbeat`，仅更新最后活跃时间，不增加访问次数。

### 数据存储
所有日志存储在 KV 的 `visitor-logs` 键中，JSON 格式。

## 🛡️ 反爬保护（已启用）

- 电脑端：禁止右键菜单、文本选择、拖拽、Ctrl+C/F12 等快捷键。
- 移动端：禁止长按弹出菜单，但不影响页面滚动。
- 如果需要暂时关闭保护，可在 `index.html` 中将反爬脚本注释掉。

## 📊 其他统计

- **Cloudflare Web Analytics**：已内嵌于页面，匿名统计页面浏览量、国家、设备等信息。登录 Cloudflare 仪表板查看。
- **足迹系统**：可详细查看每位匿名访客的停留时长和访问次数，仅供作者本人通过密码查看。

## 🛠️ 常见配置

| 配置项 | 文件位置 | 说明 |
|--------|----------|------|
| 计数器 Key | `index.html` → `VISIT_KEY` | 更换以重置全局计数 |
| 去重 Cookie 名 | `index.html` → `COOKIE_NAME` | 更改可强制所有访客重新计数 |
| 去重有效期 | `index.html` → `setCookie` 的第三个参数 | 默认 365 天 |
| 足迹口令 | `functions/api/visit-log.js` → `token !== 'ILoveBeimang'` | 修改为自己的口令 |
| 文章字数/作者 | `index.html` 底部 `.article-meta` | 直接编辑 HTML |
| 反爬开关 | `index.html` 中反爬脚本部分 | 注释或取消注释 |

## 📖 本地开发

- 直接打开 `index.html` 可预览样式。
- 计数器、足迹等 API 功能需要 Cloudflare Pages 环境，本地无法测试。

## 📄 许可

原创稿件，未经许可请勿转载。

---

> 写于 2026 年，致青春，致所有曾在时光里留下印记的人。