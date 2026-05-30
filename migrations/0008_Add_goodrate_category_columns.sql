-- Migration number: 0008
-- 在 stage_cache 中增加 good_rate / category 实体列
-- 避免排行榜查询时对 data JSON 做全表 json_extract

ALTER TABLE stage_cache ADD COLUMN good_rate TEXT;
ALTER TABLE stage_cache ADD COLUMN category  TEXT;

-- 复合索引：排行榜查询按 (region, category) 过滤，按 good_rate 排序
CREATE INDEX IF NOT EXISTS idx_stage_cache_leaderboard ON stage_cache(region, category, good_rate);
