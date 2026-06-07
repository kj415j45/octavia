import octavia, { Regions, StageNotFoundError } from './octavia';
import { Global } from './global';
import { taggedLogger } from './logger';

const MAX_BACKOFF = 7 * 24 * 3600; // 最大退避时间：7天
export const ROTATE_BATCH_SIZE = 5;
const logger = taggedLogger('scheduled');

export async function runScheduled(cron?: string) {
	const env = Global.getEnv();
	const db = env.DB;
	const now = Math.floor(Date.now() / 1000);

	// 每日北京时间凌晨 04:00 (UTC 20:00) 更新好评率排行榜
	if (cron === '0 20 * * *') {
		await updateLeaderboard();
		return;
	}

	// 取出需要滚动更新的记录（rotate_at <= now，按 rotate_at ASC 取前5）
	const rows = await db
		.prepare(
			'SELECT region, stage_id, expires_at, rotate_at FROM stage_cache WHERE rotate_at <= ? ORDER BY rotate_at ASC LIMIT ?',
		)
		.bind(now, ROTATE_BATCH_SIZE)
		.all();

	if (!rows.results || rows.results.length === 0) {
		return;
	}

	await Promise.allSettled(
		rows.results.map(async (row) => {
			const region = row.region as string;
			const stageId = row.stage_id as string;
			const oldExpiresAt = row.expires_at as number || 0;
			const rotateAt = row.rotate_at as number | null || null;

			const startTime = Date.now();
			let success = true;
			let errorMsg = '';
			let endTime;

			try {
				const result = await octavia.getStageInfo(region as Regions, stageId);
				endTime = Date.now();

				// 查询成功：更新缓存数据和 rotate_at
				const newNow = Math.floor(Date.now() / 1000);
				const expiresAt = newNow + Global.CACHE_TTL;
				const nextRotateAt = Math.floor(newNow + Global.ROTATE_INTERVAL);

				// 提取uid
				let uid: string | null = null;
				if (result?.author) {
					if (result.author.mys?.aid) {
						uid = `m${result.author.mys.aid}`;
					} else if (result.author.hyl?.aid) {
						uid = `h${result.author.hyl.aid}`;
					}
				}

				// 提取文本字段
				const name = result?.level?.meta?.name || null;
				const intro = result?.level?.meta?.intro || null;
				const description = result?.level?.meta?.description || null;
				const goodRate = result?.level?.meta?.goodRate || null;
				const category = result?.level?.meta?.category || null;

				await db
					.prepare(
						'UPDATE stage_cache SET uid = ?, name = ?, intro = ?, description = ?, good_rate = ?, category = ?, deleted = 0, data = ?, expires_at = ?, rotate_at = ? WHERE region = ? AND stage_id = ?',
					)
					.bind(uid, name, intro, description, goodRate, category, JSON.stringify(result), expiresAt, nextRotateAt, region, stageId)
					.run();

				// 更新作者信息表
				if (uid && result?.author) {
					const author = result.author;
					const platformInfo = uid.startsWith('m') ? author.mys : author.hyl;
					const avatar = platformInfo?.avatar || author.game?.avatar || octavia.getDefaultAvatar();
					const authorName = platformInfo?.name || null;
					const ingameName = author.game?.name || null;
					const pendant = uid.startsWith('h') ? author.hyl?.pendant : null;

					await db
						.prepare('INSERT OR REPLACE INTO author (uid, avatar, name, ingame_name, pendant) VALUES (?, ?, ?, ?, ?)')
						.bind(uid, avatar, authorName, ingameName, pendant)
						.run();
				}
			} catch (error: any) {
				success = false;
				errorMsg = error.message || 'Unknown error';
				logger.error(`Failed to query stage ${stageId} in ${region}:`, error);

				// 查询失败：增量退避
				const multipier = 1 + Math.random() * 2; // 退避倍数
				const newNow = Math.floor(Date.now() / 1000);
				const currentInterval = rotateAt !== null ? (rotateAt - oldExpiresAt) * multipier : Global.ROTATE_INTERVAL;
				const backoff = Math.min(Math.max(currentInterval, Global.ROTATE_INTERVAL), MAX_BACKOFF);
				const nextRotateAt = Math.floor(newNow + backoff);

				const isNotFound = error instanceof StageNotFoundError;
				await db
					.prepare('UPDATE stage_cache SET deleted = ?, rotate_at = ? WHERE region = ? AND stage_id = ?')
					.bind(isNotFound ? 1 : 0, nextRotateAt, region, stageId)
					.run();
			}

			const duration = (endTime || Date.now()) - startTime;

			// 写入 Analytics Engine
			env.analytics.writeDataPoint({
				indexes: [`${region}-${stageId}`],
				doubles: [duration, success ? 1 : 0],
				blobs: [success ? '' : errorMsg],
			});
		}),
	);
}

type ParsedStage = {
	stage_id: string;
	category: string;
	good_rate: string;
	good_rate_num: number;
	name: string | null;
	uid: string | null;
};

type StageRow = {
	stage_id: string;
	name: string | null;
	uid: string | null;
	good_rate: string | null;
	category: string | null;
};

export async function updateLeaderboard() {
	const env = Global.getEnv();
	const db = env.DB;
	const now = Math.floor(Date.now() / 1000);

	const rows = await db
		.prepare(
			`SELECT stage_id, name, uid, good_rate, category
			 FROM stage_cache
			 WHERE region = 'cn_gf01'
			   AND (deleted IS NULL OR deleted = 0)
			   AND good_rate IS NOT NULL
			   AND good_rate != ''
			   AND good_rate NOT LIKE '--%'`,
		)
		.all<StageRow>();

	if (!rows.results || rows.results.length === 0) {
		logger.warn('Leaderboard: no valid stages found for cn_gf01');
		return;
	}

	const parsed: ParsedStage[] = [];
	for (const row of rows.results) {
		if (!row.category || !row.good_rate) continue;
		const numStr = row.good_rate.replace('%', '').trim();
		const num = parseFloat(numStr);
		if (!isFinite(num) || isNaN(num)) continue;
		parsed.push({
			stage_id: row.stage_id,
			category: row.category,
			good_rate: row.good_rate,
			good_rate_num: num,
			name: row.name || null,
			uid: row.uid || null,
		});
	}

	if (parsed.length === 0) {
		logger.warn('Leaderboard: all stages had invalid goodRate values');
		return;
	}

	const categories = ['长线游玩', '轻量趣味'];
	type InsertEntry = { category: string; rank_type: string; rank: number; stage: ParsedStage };
	const inserts: InsertEntry[] = [];

	for (const category of categories) {
		const categoryStages = parsed
			.filter((s) => s.category === category)
			.sort((a, b) => b.good_rate_num - a.good_rate_num);

		if (categoryStages.length === 0) continue;

		// 前 20 名（好评率最高）
		const top20 = categoryStages.slice(0, 20);
		top20.forEach((stage, i) => {
			inserts.push({ category, rank_type: 'top', rank: i + 1, stage });
		});

		// 后 10 名（好评率最低），rank 1 = 最低
		const bottom10 = categoryStages.slice(-10).reverse();
		bottom10.forEach((stage, i) => {
			inserts.push({ category, rank_type: 'bottom', rank: i + 1, stage });
		});
	}

	if (inserts.length === 0) {
		logger.warn('Leaderboard: no entries to insert');
		return;
	}

	// 在事务中原子替换旧榜单数据
	const statements = [
		db.prepare('DELETE FROM goodrate_leaderboard'),
		...inserts.map(({ category, rank_type, rank, stage }) =>
			db
				.prepare(
					'INSERT INTO goodrate_leaderboard (snapshot_at, category, rank_type, rank, region, stage_id, good_rate, name, uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
				)
				.bind(now, category, rank_type, rank, 'cn_gf01', stage.stage_id, stage.good_rate, stage.name, stage.uid),
		),
	];

	await db.batch(statements);
	logger.info(`Leaderboard updated: ${inserts.length} entries, snapshot_at=${now}`);
}
