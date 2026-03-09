-- Migration number: 0005 	 2026-03-09T08:28:53.803Z

-- 为奇域缓存补充可搜索字段
ALTER TABLE stage_cache ADD COLUMN name TEXT;
ALTER TABLE stage_cache ADD COLUMN intro TEXT;
ALTER TABLE stage_cache ADD COLUMN description TEXT;

-- 将历史数据中的名称、简介、描述回填到新字段
UPDATE stage_cache
SET
    name = COALESCE(json_extract(data, '$.level.meta.name'), name),
    intro = COALESCE(json_extract(data, '$.level.meta.intro'), intro),
    description = COALESCE(json_extract(data, '$.level.meta.description'), description);

-- 为名称搜索与按缓存过期时间排序建立索引
CREATE INDEX IF NOT EXISTS idx_stage_cache_name ON stage_cache(name);
CREATE INDEX IF NOT EXISTS idx_stage_cache_intro ON stage_cache(intro);
CREATE INDEX IF NOT EXISTS idx_stage_cache_description ON stage_cache(description);
CREATE INDEX IF NOT EXISTS idx_stage_cache_expires_at ON stage_cache(expires_at DESC);
