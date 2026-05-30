-- 为 stage_cache 表添加 deleted 列，标识上游是否标记该奇域为不存在
ALTER TABLE stage_cache ADD COLUMN deleted INTEGER DEFAULT 0;
