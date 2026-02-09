-- 缓存表：存储奇域信息缓存
CREATE TABLE IF NOT EXISTS stage_cache (
    region TEXT NOT NULL,
    stage_id TEXT NOT NULL,
    uid TEXT,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    PRIMARY KEY (region, stage_id)
);

-- 为stage_cache表的uid字段创建索引，提高按作者查询的性能
CREATE INDEX IF NOT EXISTS idx_stage_cache_uid ON stage_cache(uid);

-- 作者信息表：存储作者详细信息
CREATE TABLE IF NOT EXISTS author (
    uid TEXT NOT NULL PRIMARY KEY,
    avatar TEXT,
    name TEXT,
    ingame_name TEXT,
    pendant TEXT
);
