-- Migration number: 0007 	 2026-05-31T00:00:00.000Z
-- 好评率排行榜表：存储每日定时生成的奇域 goodRate 排名快照
CREATE TABLE IF NOT EXISTS goodrate_leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_at INTEGER NOT NULL,
    category TEXT NOT NULL,
    rank_type TEXT NOT NULL,
    rank INTEGER NOT NULL,
    region TEXT NOT NULL,
    stage_id TEXT NOT NULL,
    good_rate TEXT NOT NULL,
    name TEXT,
    uid TEXT
);

-- 按快照时间查询最新榜单
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshot ON goodrate_leaderboard(snapshot_at DESC);

-- 按快照时间 + 分类 + 榜单类型快速检索
CREATE INDEX IF NOT EXISTS idx_leaderboard_query ON goodrate_leaderboard(snapshot_at DESC, category, rank_type, rank);
