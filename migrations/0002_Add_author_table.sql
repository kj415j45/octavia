-- Migration number: 0002 	 2026-02-09T07:58:11.800Z

-- 步骤1：创建作者信息表
CREATE TABLE IF NOT EXISTS author (
    uid TEXT NOT NULL PRIMARY KEY,
    avatar TEXT,
    name TEXT,
    ingame_name TEXT,
    pendant TEXT
);

-- 步骤2：为stage_cache表添加uid字段
ALTER TABLE stage_cache ADD COLUMN uid TEXT;

-- 步骤3：更新现有数据的uid字段
-- 从data JSON中提取作者信息，优先使用mys的aid（加m前缀），否则使用hyl的aid（加h前缀）
UPDATE stage_cache
SET uid = CASE
    WHEN json_extract(data, '$.author.mys.aid') IS NOT NULL 
        THEN 'm' || json_extract(data, '$.author.mys.aid')
    WHEN json_extract(data, '$.author.hyl.aid') IS NOT NULL 
        THEN 'h' || json_extract(data, '$.author.hyl.aid')
    ELSE NULL
END
WHERE uid IS NULL;

-- 步骤4：填充author表（从stage_cache中提取作者信息）
INSERT OR REPLACE INTO author (uid, avatar, name, ingame_name, pendant)
SELECT DISTINCT
    uid,
    CASE 
        -- 优先使用对应平台的avatar
        WHEN uid LIKE 'm%' THEN COALESCE(
            json_extract(data, '$.author.mys.avatar'),
            json_extract(data, '$.author.game.avatar')
        )
        WHEN uid LIKE 'h%' THEN COALESCE(
            json_extract(data, '$.author.hyl.avatar'),
            json_extract(data, '$.author.game.avatar')
        )
    END as avatar,
    CASE 
        -- 优先使用对应平台的name
        WHEN uid LIKE 'm%' THEN json_extract(data, '$.author.mys.name')
        WHEN uid LIKE 'h%' THEN json_extract(data, '$.author.hyl.name')
    END as name,
    json_extract(data, '$.author.game.name') as ingame_name,
    CASE 
        -- 只有hyl有pendant
        WHEN uid LIKE 'h%' THEN json_extract(data, '$.author.hyl.pendant')
        ELSE NULL
    END as pendant
FROM stage_cache
WHERE uid IS NOT NULL;

-- 完成
-- 注意：旧数据的uid字段将为NULL，会在下次缓存刷新时自动填充
