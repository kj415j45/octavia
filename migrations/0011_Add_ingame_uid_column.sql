-- 为 stage_cache 表添加 ingame_uid 列，缓存作者游戏内 UID（由 guid 派生，冗余字段，仅用于查询）
ALTER TABLE stage_cache ADD COLUMN ingame_uid TEXT;

-- 为 stage_cache 表的 ingame_uid 字段创建索引，提高按游戏内 UID 查询的性能
CREATE INDEX IF NOT EXISTS idx_stage_cache_ingame_uid ON stage_cache(ingame_uid);
