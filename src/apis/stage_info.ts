import octavia, { Regions } from '../octavia';
import { Global } from '../global';

const CACHE_TTL = 3600; // 1小时，单位：秒

export async function getStageInfo(region: string, stageId: string) {
	const validRegions = Object.values(Regions);
	if (!validRegions.includes(region as Regions)) {
		throw new Error(`Invalid region: ${region}. Valid regions are: ${validRegions.join(', ')}`);
	}

	// 尝试从缓存获取
	var cached: any;
	try {
		const db = Global.getEnv().DB;
		cached = await db.prepare('SELECT data, created_at, expires_at FROM stage_cache WHERE region = ? AND stage_id = ?').bind(region, stageId).first();

		if (cached) {
			const now = Math.floor(Date.now() / 1000);
			if ((cached.expires_at as number) > now) {
				return JSON.parse(cached.data as string);
			}
		}
	} catch (error) {
		console.error('Cache read error:', error);
		// 缓存读取失败，继续执行 API 请求
	}

	// 缓存未命中或已过期，从 API 获取数据
	const result = await octavia.getStageInfo(region as Regions, stageId).catch((error) => {
		{
			console.error('API request error:', error);
			if (cached) {
				return JSON.parse(cached.data as string);
			}
		}
	});

	// 提取uid（优先mys，加m前缀；否则hyl，加h前缀）
	let uid: string | null = null;
	if (result?.author) {
		if (result.author.mys?.aid) {
			uid = `m${result.author.mys.aid}`;
		} else if (result.author.hyl?.aid) {
			uid = `h${result.author.hyl.aid}`;
		}
	}

	// 将结果写入缓存
	try {
		const db = Global.getEnv().DB;
		const now = Math.floor(Date.now() / 1000);
		const createdAt = cached ? Math.floor(cached.created_at as number) : now;
		const expiresAt = now + CACHE_TTL;

		await db
			.prepare('INSERT OR REPLACE INTO stage_cache (region, stage_id, uid, data, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
			.bind(region, stageId, uid, JSON.stringify(result), createdAt, expiresAt)
			.run();

		// 更新作者信息表
		if (uid && result?.author) {
			const author = result.author;
			// 优先使用对应平台的信息
			const platformInfo = uid.startsWith('m') ? author.mys : author.hyl;
			const avatar = platformInfo?.avatar || author.game?.avatar || octavia.getDefaultAvatar();
			const name = platformInfo?.name || null;
			const ingameName = author.game?.name || null;
			const pendant = uid.startsWith('h') ? author.hyl?.pendant : null;

			await db
				.prepare('INSERT OR REPLACE INTO author (uid, avatar, name, ingame_name, pendant) VALUES (?, ?, ?, ?, ?)')
				.bind(uid, avatar, name, ingameName, pendant)
				.run();
		}

	} catch (error) {
		console.error('Cache write error:', error);
		// 缓存写入失败不影响返回结果
	}

	return result;
}
