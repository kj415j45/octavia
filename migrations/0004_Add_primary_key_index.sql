-- Migration number: 0004 	 2026-02-09T11:10:37.200Z

-- 为stage_cache表的主键创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_stage_cache_pk ON stage_cache(region, stage_id);

-- 为author表的主键创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_author_pk ON author(uid);
