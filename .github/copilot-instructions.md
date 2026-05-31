# Octavia 项目 Copilot 指南

## 项目简介

**Octavia**（欧科塔维亚）是一个运行在 **Cloudflare Workers** 上的 TypeScript 后端服务，为《原神》**千星奇域**（Miliastra Wonderland）功能提供数据查询、缓存和排行榜服务。  
线上域名：`octavia.kj415j45.space`

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 运行时 | Cloudflare Workers (ES2024) |
| 语言 | TypeScript 5.x |
| 数据库 | Cloudflare D1（SQLite 方言） |
| KV 存储 | Cloudflare KV Namespace |
| 可观测性 | Cloudflare Analytics Engine（SQL API） |
| 静态资源 | Cloudflare Workers Assets (`public/`) |
| 调度任务 | Cloudflare Cron Triggers |
| 构建/部署 | Wrangler 4.x |

---

## 目录结构

```
octavia/
├── src/
│   ├── index.ts          # Worker 入口：fetch + scheduled 处理器
│   ├── global.ts         # 全局单例：env / ctx 存取
│   ├── logger.ts         # 带标签日志工具 taggedLogger(tag)
│   ├── octavia.ts        # HoYo API 客户端（核心爬取逻辑）+ StageNotFoundError
│   ├── scheduled.ts      # Cron 任务：缓存滚动更新 + 排行榜生成
│   └── apis/
│       ├── stage_info.ts     # GET /api/stage — 带缓存的奇域详情
│       ├── stage_search.ts   # GET /api/search/stage — D1 LIKE 搜索
│       ├── status.ts         # GET /api/status — Analytics Engine 监控数据
│       ├── author.ts         # GET /api/author — 作者信息查询
│       ├── leaderboard.ts    # GET /api/leaderboard — 好评率排行榜
│       └── maintain.ts       # POST /api/maintain — TOTP 保护的运维接口
├── public/               # 静态前端（Bootstrap 5 + 原生 JS）
│   ├── index.html        # 主页（奇域查询）
│   ├── database.html     # 奇域数据库
│   ├── author.html       # 作者页
│   ├── leaderboard.html  # 排行榜
│   ├── status.html       # 服务状态
│   ├── maintain.html     # 运维控制台
│   └── lib/
│       ├── common.js     # 前端公共工具（API 调用封装）
│       └── regions.json  → /data/regions.json（前端通过 fetch 加载）
├── migrations/           # D1 增量迁移 SQL（顺序执行）
├── schema.sql            # 完整 D1 Schema（参考用）
├── wrangler.jsonc        # Cloudflare Workers 配置
├── worker-configuration.d.ts  # 自动生成的 Env 类型定义
└── tsconfig.json
```

---

## Env 绑定（`worker-configuration.d.ts`）

```typescript
interface Env {
  kv: KVNamespace;          // bonus 内容存储
  DB: D1Database;           // 主数据库
  analytics: AnalyticsEngineDataset;  // 性能指标写入
  PUBLIC: Fetcher;          // 静态资源绑定
  ACCOUNT_ID: string;       // Cloudflare 账户 ID（secret）
  ANALYTICS_API_TOKEN: string; // Analytics SQL API Token（secret）
  TOTP_SECRET: string;      // 运维接口 TOTP 密钥（secret）
}
```

---

## API 路由总览

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/test` | 健康检查 |
| `GET` | `/api/stage?region=&id=` | 奇域详情（带 D1 缓存） |
| `GET` | `/api/search/stage?q=&page=` | 奇域关键词搜索 |
| `GET` | `/api/bonus?hash=` | KV 奖励内容读取 |
| `GET` | `/api/status` | 服务可观测性数据 |
| `GET` | `/api/author?id=` | 作者信息查询 |
| `GET` | `/api/leaderboard` | 好评率排行榜 |
| `POST` | `/api/maintain` | 运维操作（TOTP 鉴权） |
| `OPTIONS` | `*` | CORS 预检（全局返回 200） |

---

## D1 数据库 Schema

### `stage_cache` — 奇域缓存
主键 `(region, stage_id)`。  
- `data TEXT` — JSON 字符串，完整上游 API 响应  
- `expires_at INTEGER` — Unix 秒，超过则缓存过期  
- `rotate_at INTEGER` — Unix 秒，scheduled 任务按此字段选取待刷新行  
- `deleted INTEGER DEFAULT 0` — 1 表示已下架  
- `uid TEXT` — 作者 UID（`m<aid>` 国服 / `h<aid>` 国际服）  

### `author` — 作者信息
主键 `uid`。字段：`avatar`, `name`, `ingame_name`, `pendant`。

### `goodrate_leaderboard` — 好评率排行榜快照
每日 04:00 北京时间（UTC 20:00）生成快照。  
`rank_type`: `'top'`（前 20）/ `'bottom'`（后 10）。

---

## 缓存与调度策略

- `CACHE_TTL = 3600s`（1 小时）：缓存有效期  
- `ROTATE_INTERVAL = 28800s`（8 小时）：主动刷新间隔  
- Cron `* * * * *`：每分钟取 `rotate_at <= now` 的 5 条记录批量刷新  
- 失败时采用指数退避（随机乘数 1~3×），最长退避 7 天  
- Cron `0 20 * * *`：每日更新排行榜快照  

---

## 区域（Region）

```typescript
enum Regions {
  CN_GF   = 'cn_gf01',   // 国服官服
  CN_BILI = 'cn_qd01',   // 国服 B 服
  CN_CHT  = 'os_cht',    // 港澳台服
  GLB_AS  = 'os_asia',   // 国际服亚服
  GLB_EU  = 'os_euro',   // 国际服欧服
  GLB_NA  = 'os_usa',    // 国际服美服
}
```

- `cn_gf01` / `cn_qd01` → `bbs-api.miyoushe.com`  
- 其余 → `bbs-api-os.hoyolab.com`  

---

## 上游 API 要点

- 端点：`POST .../community/ugc_community/web/api/level/full/info`  
- 请求头：`X-Rpc-Language: zh-cn`，`User-Agent: Octavia/1.0.0 (kj415j45/octavia)`  
- 超时：`AbortSignal.timeout(3000)`（3 秒）  
- `retcode -2000431` → `StageNotFoundError`  

---

## 运维接口（`POST /api/maintain`）

请求体：`{ totp: "6位码", action: "...", ...参数 }`  
TOTP 采用 RFC 6238（±2 步 / ±60 秒窗口），密钥 Base32 编码，使用 `crypto.subtle`。

| action | 参数 | 说明 |
|--------|------|------|
| `flush_cache` | `region`, `stage_ids[]` | 强制过期并后台重拉 |
| `update_leaderboard` | — | 立即重建排行榜快照 |
| `get_kv` | `hash` | 读取 KV 值 |
| `set_kv` | `hash`, `value` | 写入 KV 值 |

---

## 开发规范

1. **访问 env/ctx 统一通过 `Global.getEnv()` / `Global.getCtx()`**，不要将 env 作为函数参数层层传递。  
2. **日志统一使用 `taggedLogger(tag)`**，tag 格式为 `'api:模块名'` 或 `'模块名'`。  
3. **D1 查询使用参数化绑定**（`.bind(...)`），禁止拼接 SQL 字符串。  
4. **添加新 API**：在 `src/apis/` 新建处理函数，在 `src/index.ts` 的 switch 中注册路由。  
5. **添加 D1 字段/表**：在 `migrations/` 新增 `NNNN_Describe.sql` 文件，同步更新 `schema.sql`。  
6. **类型定义**：Env 类型由 `wrangler types`（`npm run cf-typegen`）自动生成，不要手动修改 `worker-configuration.d.ts`。  
7. **CORS**：所有 API 响应已统一附加 `Access-Control-Allow-Origin: *`，OPTIONS 预检在入口统一处理。  
8. **前端无构建工具**：`public/` 目录是原生 HTML + Bootstrap 5 + 原生 JS，不使用打包工具。  

---

## 常用命令

```bash
npm run dev        # wrangler dev 本地开发
npm run deploy     # wrangler deploy 部署
npm run cf-typegen # 重新生成 Env 类型
npm test           # vitest 单元测试
```
