import octavia, { Regions } from './octavia';
import { Global } from './global';
import { taggedLogger } from './logger';

const MAX_BACKOFF = 7 * 24 * 3600; // 最大退避时间：7天
const ROTATE_BATCH_SIZE = 5;
const logger = taggedLogger('scheduled');

export async function runScheduled() {
	const env = Global.getEnv();
	const db = env.DB;
	const now = Math.floor(Date.now() / 1000);

	// 取出需要滚动更新的记录（rotate_at <= now 或 rotate_at 为 NULL，按 rotate_at ASC 取前5）
	const rows = await db
		.prepare(
			'SELECT region, stage_id, expires_at, rotate_at FROM stage_cache WHERE rotate_at IS NULL OR rotate_at <= ? ORDER BY rotate_at ASC LIMIT ?',
		)
		.bind(now, ROTATE_BATCH_SIZE)
		.all();

	if (!rows.results || rows.results.length === 0) {
		return;
	}

	await Promise.all(
		rows.results.map(async (row) => {
			const region = row.region as string;
			const stageId = row.stage_id as string;
			const oldExpiresAt = row.expires_at as number;
			const rotateAt = row.rotate_at as number | null;

			const startTime = Date.now();
			let success = true;
			let errorMsg = '';

			try {
				const result = await octavia.getStageInfo(region as Regions, stageId);

				// 查询成功：更新缓存数据和 rotate_at
				const newNow = Math.floor(Date.now() / 1000);
				const expiresAt = newNow + Global.CACHE_TTL;
				const nextRotateAt = newNow + Global.ROTATE_INTERVAL;

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

				await db
					.prepare(
						'UPDATE stage_cache SET uid = ?, name = ?, intro = ?, description = ?, data = ?, expires_at = ?, rotate_at = ? WHERE region = ? AND stage_id = ?',
					)
					.bind(uid, name, intro, description, JSON.stringify(result), expiresAt, nextRotateAt, region, stageId)
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
				const newNow = Math.floor(Date.now() / 1000);
				const currentInterval = rotateAt !== null ? rotateAt - oldExpiresAt : Global.ROTATE_INTERVAL;
				const backoff = Math.min(Math.max(currentInterval, Global.ROTATE_INTERVAL), MAX_BACKOFF);
				const nextRotateAt = newNow + backoff;

				await db
					.prepare('UPDATE stage_cache SET rotate_at = ? WHERE region = ? AND stage_id = ?')
					.bind(nextRotateAt, region, stageId)
					.run();
			}

			const duration = Date.now() - startTime;

			// 写入 Analytics Engine
			env.analytics.writeDataPoint({
				indexes: [`${region}-${stageId}`],
				doubles: [duration, success ? 1 : 0],
				blobs: [success ? '' : errorMsg],
			});
		}),
	);
}
