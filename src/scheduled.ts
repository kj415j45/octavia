import { syncActivityStageList } from './schedule/activity_stage_list';
import { rotateStageCache } from './schedule/rotate_stage_cache';
import { taggedLogger } from './logger';

const log = taggedLogger('scheduled');

export async function runScheduled(cron?: string) {
	if (cron === '*/35 * * * *') {
		await syncActivityStageList();
		return;
	}

	if (cron === '* * * * *') {
		await rotateStageCache();
	}

	log.warn(`Unknown cron expression: ${cron}`);
}