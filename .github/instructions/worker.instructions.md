---
applyTo: "src/**"
---

# Worker 运行时 — 编码规范

## 环境与上下文

- **所有模块通过 `Global.getEnv()` / `Global.getCtx()` 获取 `env` 和 `ctx`**，禁止将它们作为参数向下传递。
- 在 `fetch` / `scheduled` 入口处已调用 `Global.setEnv(env)` 和 `Global.setCtx(ctx)`，其他模块直接调用 getter 即可。

```typescript
// ✅ 正确
const db = Global.getEnv().DB;

// ❌ 错误：不要把 env 当参数传进去
async function doSomething(env: Env) { ... }
```

## 日志

- 统一使用 `taggedLogger(tag)` 工厂函数。
- tag 命名规范：Worker 核心用模块名（`'octavia'`、`'scheduled'`），API 处理器用 `'api:模块名'`（如 `'api:stage_info'`）。
- 只在错误/警告场景输出 `logger.error` / `logger.warn`；调试信息用 `logger.debug`（生产环境默认不展示）。

```typescript
const logger = taggedLogger('api:my_feature');
logger.error('Something went wrong:', error);
```

## 错误处理

- 在 `src/index.ts` 路由层捕获已知业务错误（如 `StageNotFoundError`），返回对应 HTTP 状态码。
- API 函数内部**不负责构造 HTTP 响应**，只负责抛出语义化错误或返回数据。
- 超时使用 `AbortSignal.timeout(milliseconds)`，捕获 `DOMException` 且 `name === 'TimeoutError'`。

## CORS

- 所有 `GET` API 响应需附加 CORS 头（`src/index.ts` 中 `JSONResponse` / `TextResponse` 已统一处理）。
- `OPTIONS` 预检已在入口统一拦截，无需在各 API 模块中重复处理。

## 异步后台任务

- 需要异步执行但不阻塞响应的操作，使用 `Global.getCtx().waitUntil(promise)`。

## TypeScript 规范

- `target` / `lib` 均为 `es2024`，可使用所有 ES2024 特性。
- `moduleResolution: Bundler`，导入路径不需要 `.js` 后缀。
- 不要修改 `worker-configuration.d.ts`，它由 `npm run cf-typegen` 自动生成。
