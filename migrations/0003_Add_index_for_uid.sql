-- Migration number: 0003 	 2026-02-09T09:43:53.930Z

-- 为stage_cache表的uid字段创建索引，提高按作者查询的性能
CREATE INDEX IF NOT EXISTS idx_stage_cache_uid ON stage_cache(uid);
