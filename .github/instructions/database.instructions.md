---
applyTo: "{schema.sql,migrations/**}"
---

# 数据库 Schema — 编码规范

## 数据库方言

Cloudflare D1 使用 **SQLite 方言**，不支持 PostgreSQL / MySQL 语法。

## 迁移文件规范

- 文件命名：`migrations/NNNN_Describe.sql`，序号 4 位数字，顺序严格递增。
- 每个迁移文件只包含**一次性 DDL 操作**（`ALTER TABLE`、`CREATE TABLE`、`CREATE INDEX` 等）。
- **禁止修改已合并的历史迁移文件**，变更必须新建迁移文件。
- 添加迁移文件后，同步更新 `schema.sql`（维护完整 Schema 的参考版本）。

## 表结构约定

### `stage_cache` — 奇域缓存

```sql
PRIMARY KEY (region, stage_id)  -- 复合主键
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `region` | TEXT | 区服 ID（如 `cn_gf01`） |
| `stage_id` | TEXT | 奇域 ID |
| `uid` | TEXT | 作者 UID（`m<aid>` 或 `h<aid>`） |
| `name` / `intro` / `description` | TEXT | 文本索引字段，供搜索使用 |
| `good_rate` | TEXT | 好评率字符串（如 `"98.5%"`） |
| `category` | TEXT | 分类（`长线游玩` / `轻量趣味`） |
| `deleted` | INTEGER | `0` 正常 / `1` 已下架 |
| `data` | TEXT | 完整上游响应的 JSON 字符串 |
| `created_at` | INTEGER | 首次写入 Unix 秒 |
| `expires_at` | INTEGER | 缓存到期 Unix 秒 |
| `rotate_at` | INTEGER | 定时刷新触发 Unix 秒 |

### `author` — 作者信息

```sql
PRIMARY KEY (uid)
```

`uid` 格式：`m<aid>`（米游社） 或 `h<uid>`（HoYoLab）。

### `goodrate_leaderboard` — 好评率排行榜快照

- `snapshot_at`：快照生成时刻 Unix 秒。
- `rank_type`：`'top'`（好评最高前 20）/ `'bottom'`（好评最低后 10）。
- `rank`：排名，`top` 中 1 = 最高；`bottom` 中 1 = 最低。

## 索引规范

- 为所有频繁作为 `WHERE` 条件的字段建立索引。
- 排行榜查询需覆盖索引：`(snapshot_at DESC, category, rank_type, rank)`。
- 唯一约束字段同时创建 `UNIQUE INDEX`（D1 不自动为 PRIMARY KEY 创建唯一索引）。

## 常见坑

- D1 没有布尔类型，用 `INTEGER`（0/1）代替。  
- D1 没有自动时间戳，需在应用层传入 `Math.floor(Date.now() / 1000)`。  
- `INSERT OR REPLACE` 会删除旧行再插入（触发 `AUTOINCREMENT` 自增），`INSERT OR REPLACE` 和 `UPDATE` 请按业务需要选择。
