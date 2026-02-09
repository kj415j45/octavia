-- Migration number: 0001 	 2026-02-09T07:54:24.453Z
-- 缓存表：存储奇域信息缓存
CREATE TABLE IF NOT EXISTS stage_cache (
    region TEXT NOT NULL,
    stage_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    PRIMARY KEY (region, stage_id)
);
