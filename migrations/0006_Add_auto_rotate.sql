-- Migration number: 0006 	 2026-03-23T01:49:27.842Z
-- 为stage_cache表新增rotate_at字段，表示下一次滚动查询的计划时间
ALTER TABLE stage_cache ADD COLUMN rotate_at INTEGER;

-- 为rotate_at创建索引，提高滚动查询选取性能
CREATE INDEX IF NOT EXISTS idx_stage_cache_rotate_at ON stage_cache(rotate_at ASC);
