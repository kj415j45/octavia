import octavia, { Regions } from '../octavia';
import { Global } from '../global';

const CACHE_TTL = 3600; // 1小时，单位：秒

export async function getStageInfo(region: string, stageId: string) {
	const validRegions = Object.values(Regions);
	if (!validRegions.includes(region as Regions)) {
		throw new Error(`Invalid region: ${region}. Valid regions are: ${validRegions.join(', ')}`);
	}

	// 尝试从缓存获取
	try {
		const db = Global.getEnv().DB;
		const cached = await db
			.prepare('SELECT data, expires_at FROM stage_cache WHERE region = ? AND stage_id = ?')
			.bind(region, stageId)
			.first();

		if (cached) {
			const now = Math.floor(Date.now() / 1000);
			if ((cached.expires_at as number) > now) {
				console.debug('Cache hit for:', region, stageId);
				return JSON.parse(cached.data as string);
			}
			console.debug('Cache expired for:', region, stageId);
		}
	} catch (error) {
		console.error('Cache read error:', error);
		// 缓存读取失败，继续执行 API 请求
	}

	// 缓存未命中或已过期，从 API 获取数据
	const result = await octavia.getStageInfo(region as Regions, stageId);

	// 将结果写入缓存
	try {
		const db = Global.getEnv().DB;
		const now = Math.floor(Date.now() / 1000);
		const expiresAt = now + CACHE_TTL;

		await db
			.prepare('INSERT OR REPLACE INTO stage_cache (region, stage_id, data, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
			.bind(region, stageId, JSON.stringify(result), now, expiresAt)
			.run();

		console.debug('Cached stage info for:', region, stageId);
	} catch (error) {
		console.error('Cache write error:', error);
		// 缓存写入失败不影响返回结果
	}

	return result;
}
