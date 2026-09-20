-- 移除低使用率的好评率排行榜功能及其冗余缓存列
DROP TABLE IF EXISTS goodrate_leaderboard;

DROP INDEX IF EXISTS idx_stage_cache_leaderboard;

ALTER TABLE stage_cache DROP COLUMN good_rate;
ALTER TABLE stage_cache DROP COLUMN category;