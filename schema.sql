-- 缓存表：存储奇域信息缓存
CREATE TABLE IF NOT EXISTS stage_cache (
    region TEXT NOT NULL,
    stage_id TEXT NOT NULL,
    uid TEXT,
    name TEXT,
    intro TEXT,
    description TEXT,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    PRIMARY KEY (region, stage_id)
);

-- 为stage_cache表的uid字段创建索引，提高按作者查询的性能
CREATE INDEX IF NOT EXISTS idx_stage_cache_uid ON stage_cache(uid);

-- 为stage_cache表的名称字段创建索引，提高数据库搜索的性能
CREATE INDEX IF NOT EXISTS idx_stage_cache_name ON stage_cache(name);

-- 为stage_cache表的简介字段创建索引
CREATE INDEX IF NOT EXISTS idx_stage_cache_intro ON stage_cache(intro);

-- 为stage_cache表的描述字段创建索引
CREATE INDEX IF NOT EXISTS idx_stage_cache_description ON stage_cache(description);

-- 为stage_cache表的缓存过期时间创建索引，提高按最近刷新排序的性能
CREATE INDEX IF NOT EXISTS idx_stage_cache_expires_at ON stage_cache(expires_at DESC);

-- 为stage_cache表的主键创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_stage_cache_pk ON stage_cache(region, stage_id);

-- 作者信息表：存储作者详细信息
CREATE TABLE IF NOT EXISTS author (
    uid TEXT NOT NULL PRIMARY KEY,
    avatar TEXT,
    name TEXT,
    ingame_name TEXT,
    pendant TEXT
);

-- 为author表的主键创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_author_pk ON author(uid);
