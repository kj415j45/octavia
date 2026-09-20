---
applyTo: "src/scheduled.ts"
---

# 定时任务 — 编码规范

## Cron 分发逻辑

`runScheduled(cron)` 通过 `cron` 字符串区分任务：

| Cron 表达式 | 触发时间 | 任务 |
|-------------|----------|------|
| `* * * * *` | 每分钟 | 滚动刷新最多 5 条到期缓存 |

新增 Cron 时：
1. 在 `wrangler.jsonc` 的 `triggers.crons` 数组添加表达式。
2. 在 `runScheduled` 中用 `if (cron === '...')` 分支处理。

## 缓存滚动刷新（`* * * * *`）

- 每次取 `rotate_at <= now` 且按 `rotate_at ASC` 排序的前 **5** 条（`ROTATE_BATCH_SIZE`）。
- 并发执行（`Promise.allSettled`），单条失败不影响其他条目。
- **成功**：更新 `data`、`expires_at`、`rotate_at`（`now + ROTATE_INTERVAL`），同步更新 `author` 表。
- **失败（StageNotFoundError）**：标记 `deleted = 1`，退避后设置下次 `rotate_at`。
- **其他失败**：`deleted` 保持不变（0），退避后设置下次 `rotate_at`。

## 退避策略

```
currentInterval = (rotate_at - expires_at) * random(1, 3)
backoff = clamp(currentInterval, ROTATE_INTERVAL, MAX_BACKOFF)
```

- 初始退避：`ROTATE_INTERVAL`（8 小时）
- 随机乘数：`1 + Math.random() * 2`（1x ~ 3x）  
- 上限：`MAX_BACKOFF = 7 * 24 * 3600`（7 天）

## Analytics Engine 上报

每条记录处理完成后写入 Analytics Engine：

```typescript
env.analytics.writeDataPoint({
  indexes: [`${region}-${stageId}`],   // 区分维度
  doubles: [duration, success ? 1 : 0], // double1 = 耗时(ms), double2 = 成功标志
  blobs: [success ? '' : errorMsg],     // blob1 = 错误信息
});
```
