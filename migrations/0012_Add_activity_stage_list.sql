-- 活动奇域列表表：存储运营活动（如投稿评选）对应的奇域列表快照
CREATE TABLE IF NOT EXISTS activity_stage_list (
    activity_name TEXT NOT NULL PRIMARY KEY,
    data TEXT NOT NULL
);

-- 为 activity_stage_list 表的主键创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_stage_list_pk ON activity_stage_list(activity_name);
