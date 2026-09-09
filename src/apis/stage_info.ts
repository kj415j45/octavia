import octavia, { Regions, StageNotFoundError } from '../octavia';
import { Global } from '../global';
import { taggedLogger } from '../logger';

const logger = taggedLogger('api:stage_info');

type RequestStatus = {
	cache: boolean; // 是否使用了缓存
	upstream: boolean | null; // 上游是否可用，null表示未知（仅当cache为false时有效）
	removed: boolean | null; // 是否已被下架（upstream为true时表示上游确认删除，upstream为null时表示缓存记录已删除但上游未响应）
};

function getCachedStageTextFields(result: any) {
	return {
		name: result?.level?.meta?.name || null,
		intro: result?.level?.meta?.intro || null,
		description: result?.level?.meta?.description || null,
		goodRate: result?.level?.meta?.goodRate || null,
		category: result?.level?.meta?.category || null,
	};
}

function normalizeStageId(stageId: string): string {
	const trimmedStageId = stageId.trim();
	if (/^0+\d+$/.test(trimmedStageId)) {
		return trimmedStageId.replace(/^0+/, '') || '0';
	}
	return trimmedStageId;
}

function extractVersionNumber(version: string | number | null | undefined): string {
	if (version == null) {
		return '';
	}
	return String(version).replace(/^[^\d]*/, '').trim();
}

function compareVersionStrings(a: string, b: string): number {
	const pa = extractVersionNumber(a).split('.').filter(Boolean).map((part) => Number(part) || 0);
	const pb = extractVersionNumber(b).split('.').filter(Boolean).map((part) => Number(part) || 0);
	const maxLength = Math.max(pa.length, pb.length);

	for (let i = 0; i < maxLength; i++) {
		const va = pa[i] ?? 0;
		const vb = pb[i] ?? 0;
		if (va !== vb) {
			return va - vb;
		}
	}
	return 0;
}

function mergeVersionInfo(versionInfo: any, cachedVersionInfo: any, now: number) {
	if (!versionInfo || typeof versionInfo !== 'object') {
		return versionInfo;
	}

	const latestVersion = versionInfo.latest ? String(versionInfo.latest) : null;
	const changelog = Array.isArray(versionInfo.changelog) ? versionInfo.changelog : [];
	const cachedChangelog = Array.isArray(cachedVersionInfo?.changelog) ? cachedVersionInfo.changelog : [];
	const mergedMap = new Map<string, any>();

	for (const entry of cachedChangelog) {
		if (!entry || !entry.version) {
			continue;
		}
		const version = String(entry.version);
		const versionKey = extractVersionNumber(version);
		mergedMap.set(versionKey, {
			...mergedMap.get(versionKey),
			...entry,
			version,
		});
	}

	for (const entry of changelog) {
		if (!entry || !entry.version) {
			continue;
		}
		const version = String(entry.version);
		const versionKey = extractVersionNumber(version);
		mergedMap.set(versionKey, {
			...mergedMap.get(versionKey),
			...entry,
			version,
		});
	}

	const latestIndex = latestVersion
		? changelog.findIndex((entry: any) => compareVersionStrings(String(entry?.version), latestVersion) === 0)
		: -1;
	if (latestVersion && latestIndex < 0) {
		return versionInfo;
	}

	const ordered = [...mergedMap.values()].sort((a, b) => compareVersionStrings(b.version, a.version));
	if (ordered.length === 0) {
		return versionInfo;
	}

	const newestVersion = latestVersion ? String(latestVersion) : ordered[ordered.length - 1]?.version;
	if (!newestVersion) {
		return versionInfo;
	}

	const newestEntry = mergedMap.get(extractVersionNumber(newestVersion));
	if (newestEntry && newestEntry.start_at === undefined) {
		newestEntry.start_at = now;
		delete newestEntry.end_at;

		const endedVersion = changelog[latestIndex + 1]?.version;
		const endedEntry = endedVersion == null ? null : mergedMap.get(extractVersionNumber(String(endedVersion)));
		if (endedEntry) {
			endedEntry.end_at = endedEntry.end_at ?? now;
		}
	}

	const normalizedChangelog = ordered.map((entry) => {
		const normalized = { ...entry };
		if (normalized.start_at === undefined) {
			delete normalized.start_at;
		}
		if (normalized.end_at === undefined) {
			delete normalized.end_at;
		}
		return normalized;
	});

	return {
		...versionInfo,
		latest: newestVersion,
		updateInfo: versionInfo.updateInfo ?? changelog[latestIndex]?.content ?? '',
		changelog: normalizedChangelog,
	};
}

export async function getStageInfo(region: string, stageId: string) {
	if(region.trim() === '') {
		region = octavia.guidToRegion(stageId) ?? region;
	}
	const validRegions = Object.values(Regions);
	if (!validRegions.includes(region as Regions)) {
		throw new Error(`Invalid region: ${region}. Valid regions are: ${validRegions.join(', ')}`);
	}

	const normalizedStageId = normalizeStageId(stageId);

	const status: RequestStatus = {
		cache: false,
		upstream: null,
		removed: null,
	};

	// 尝试从缓存获取
	let cached: any;
	try {
		const db = Global.getEnv().DB;
		cached = await db
			.prepare('SELECT data, created_at, expires_at, deleted FROM stage_cache WHERE region = ? AND stage_id = ?')
			.bind(region, normalizedStageId)
			.first();

		if (cached) {
			const now = Math.floor(Date.now() / 1000);
			if ((cached.expires_at as number) > now) {
				const data = cached.data;
				status.cache = true;
				const ret = Object.assign(JSON.parse(data as string), { status });
				return ret;
			}
		}
	} catch (error) {
		logger.error('Cache read error:', error);
		// 缓存读取失败，继续执行 API 请求
	}

	// 缓存未命中或已过期，从 API 获取数据
	let result: any;
	try {
		status.upstream = true;
		result = await octavia.getStageInfo(region as Regions, normalizedStageId);
		status.removed = false;
	} catch (error) {
		if (error instanceof StageNotFoundError) {
			status.removed = true;
			if (cached) {
				logger.warn(`Stage ${normalizedStageId} in region ${region} not found. Using cache.`);
				try {
					const db = Global.getEnv().DB;
					await db
						.prepare('UPDATE stage_cache SET deleted = 1 WHERE region = ? AND stage_id = ?')
						.bind(region, normalizedStageId)
						.run();
				} catch (dbError) {
					logger.error('Failed to mark stage as deleted:', dbError);
				}
				const data = cached.data;
				status.cache = true;
				const ret = Object.assign(JSON.parse(data as string), { status });
				return ret;
			}
		} else if (error instanceof DOMException && error.name === 'TimeoutError') {
			status.upstream = null; // 上游状态未知
			logger.warn('API request timed out. Upstream status unknown.');
			if (cached) {
				logger.warn(`Using cache for stage ${normalizedStageId} in region ${region} due to timeout.`);
				if (cached.deleted) {
					status.removed = true;
				}
				const data = cached.data;
				status.cache = true;
				const ret = Object.assign(JSON.parse(data as string), { status });
				return ret;
			}
		}
		status.upstream = false;
		logger.error('API request error:', error);
		throw error;
	}

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
		const expiresAt = now + Global.CACHE_TTL;
		const rotateAt = now + Global.ROTATE_INTERVAL;
		const { name, intro, description, goodRate, category } = getCachedStageTextFields(result);
		let cachedVersionInfo: any = null;
		if (cached?.data) {
			try {
				cachedVersionInfo = JSON.parse(cached.data as string)?.level?.version ?? null;
			} catch (error) {
				logger.warn('Failed to parse cached version info:', error);
			}
		}
		result.level.version = mergeVersionInfo(result.level.version, cachedVersionInfo, now);

		await db
			.prepare(
					'INSERT OR REPLACE INTO stage_cache (region, stage_id, uid, name, intro, description, good_rate, category, deleted, data, created_at, expires_at, rotate_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)',
				)
				.bind(region, normalizedStageId, uid, name, intro, description, goodRate, category, JSON.stringify(result), createdAt, expiresAt, rotateAt)
				.run();
		// 更新作者信息表
		if (uid && result?.author) {
			const author = result.author;
			// 优先使用对应平台的信息
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
	} catch (error) {
		logger.error('Cache write error:', error);
		// 缓存写入失败不影响返回结果
	}

	Object.assign(result, { status });
	return result;
}
