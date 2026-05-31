---
applyTo: "src/apis/**"
---

# API 处理器 — 编码规范

## 文件职责

`src/apis/` 中每个文件对应一个 API 端点的业务逻辑，**不负责路由匹配**。  
路由注册在 `src/index.ts` 的 `switch` 语句中完成。

## 添加新 API 步骤

1. 在 `src/apis/` 新建 `my_feature.ts`。
2. 导出一个命名函数（如 `export async function getMyFeature(...)`）。
3. 在 `src/index.ts` 的 `switch (endpoint)` 中新增 `case 'my_feature'`，调用该函数并用 `JSONResponse()` 包装返回值。

## 函数签名约定

- 接收业务参数（从 URL 中解析好的字符串），**不接收 `Request` 对象**（`maintain.ts` 是唯一例外，因为它需要读取 POST body）。
- 返回纯数据对象（不返回 `Response`）；由 `src/index.ts` 统一包装为 HTTP 响应。

## 数据库访问

- **始终使用参数化绑定**，禁止拼接 SQL 字符串，防止 SQL 注入。

```typescript
// ✅ 正确
const row = await db.prepare('SELECT * FROM author WHERE uid = ?').bind(uid).first();

// ❌ 错误
const row = await db.prepare(`SELECT * FROM author WHERE uid = '${uid}'`).first();
```

- LIKE 搜索需对特殊字符转义：`%`、`_`、`\` 需要用 `REPLACE` 链式转义，并指定 `ESCAPE '\\'`。参见 `stage_search.ts` 中的实现。

## 区域校验

- 接收 `region` 参数的 API，必须用 `Object.values(Regions)` 校验合法性，非法时抛出错误（或返回 400）。

```typescript
const validRegions = Object.values(Regions);
if (!validRegions.includes(region as Regions)) {
  throw new Error(`Invalid region: ${region}`);
}
```

## 缓存读写（stage_info 模式）

- **先读缓存**：若 `expires_at > now`，直接返回并标记 `status.cache = true`。
- **后写缓存**：上游请求成功后，`INSERT OR REPLACE` 写入 D1，**缓存写入失败不影响返回结果**（catch 后只记录日志）。
- `uid` 格式：米游社来源前缀为 `m`（`m<aid>`），HoYoLab 来源前缀为 `h`（`h<aid>`）。

## maintain.ts 安全要求

- TOTP 验证必须在处理任何 `action` 之前完成，验证逻辑不可绕过。
- TOTP 使用 RFC 6238，时间步长 30s，±2 步容差（±60 秒窗口），通过 `crypto.subtle` 实现，不依赖外部库。
- 所有 `action` 分支均需校验必要参数，缺参数时返回 400。

## 响应辅助函数

`maintain.ts` 内定义了 `jsonOk()` / `jsonError()` 局部辅助函数，仅供该模块使用。  
全局 API 响应通过 `src/index.ts` 的 `JSONResponse()` / `TextResponse()` 包装。
