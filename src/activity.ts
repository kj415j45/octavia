import { Global } from './global';
import { taggedLogger } from './logger';

const logger = taggedLogger('activity');
const defaultUA = 'Octavia/1.0.0 (kj415j45/octavia)';

// 压缩存储：[guid, first_online_time]，其余字段暂无使用场景
type ActivityStageItem = [string, number];

interface ActivityStageData {
	updated_at: number;
	latest_first_online_time: number;
	items: ActivityStageItem[];
}

/**
 * 同步单个活动（活动ID + 大区）的奇域列表。
 * 接口按 first_online_time 降序返回，翻页直到追上上次已知的最新时间戳或到达列表末尾。
 */
export async function syncActivityStageList(eventId: string, region: string) {
	const db = Global.getEnv().DB;
	const activityName = `${eventId}:${region}`;

	const existingRow = await db
		.prepare('SELECT data FROM activity_stage_list WHERE activity_name = ?')
		.bind(activityName)
		.first<{ data: string }>();
	const existing: ActivityStageData = existingRow
		? JSON.parse(existingRow.data)
		: { updated_at: 0, latest_first_online_time: 0, items: [] };

	const timeByGuid = new Map<string, number>();
	for (const [guid, time] of existing.items) {
		timeByGuid.set(guid, time);
	}

	let cursor = '';
	let caughtUp = false;
	let maxSeenTime = existing.latest_first_online_time;
	let fetchedCount = 0;

	while (!caughtUp) {
		const url = new URL(`https://hk4e-api.mihoyo.com/event/${eventId}/contest_level_list`);
		url.searchParams.set('game_biz', 'hk4e_cn');
		url.searchParams.set('lang', 'zh-cn');
		url.searchParams.set('region', region);
		url.searchParams.set('cursor', cursor);
		url.searchParams.set('sort', '0');

		const response = await fetch(url.toString(), {
			headers: { 'User-Agent': defaultUA },
			signal: AbortSignal.timeout(5000),
		});
		const json: any = await response.json();
		if (json.retcode !== 0) {
			throw new Error(`Upstream error for activity ${activityName}: ${json.retcode} ${json.message}`);
		}

		const items: { guid: string; first_online_time: string }[] = json.data.items || [];
		for (const item of items) {
			const time = Number(item.first_online_time) || 0;
			timeByGuid.set(item.guid, time);
			fetchedCount++;
			if (time > maxSeenTime) {
				maxSeenTime = time;
			}
			if (time <= existing.latest_first_online_time) {
				caughtUp = true;
			}
		}

		if (json.data.is_end || !json.data.next_cursor) {
			break;
		}
		cursor = json.data.next_cursor;
	}

	const mergedItems: ActivityStageItem[] = Array.from(timeByGuid.entries()).sort((a, b) => b[1] - a[1]);

	const newData: ActivityStageData = {
		updated_at: Math.floor(Date.now() / 1000),
		latest_first_online_time: maxSeenTime,
		items: mergedItems,
	};

	await db
		.prepare(
			'INSERT INTO activity_stage_list (activity_name, data) VALUES (?, ?) ON CONFLICT(activity_name) DO UPDATE SET data = excluded.data',
		)
		.bind(activityName, JSON.stringify(newData))
		.run();


	logger.debug(`Synced activity ${activityName}: fetched ${fetchedCount}, total ${mergedItems.length} stages`);
}
