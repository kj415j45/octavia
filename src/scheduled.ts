import { syncActivityStageList } from './schedule/activity_stage_list';
import { rotateStageCache } from './schedule/rotate_stage_cache';
import { taggedLogger } from './logger';

const log = taggedLogger('scheduled');

export async function runScheduled(cron?: string) {
	if (cron?.trim() === '*/35 * * * *') {
		return await syncActivityStageList();
	}

	if (cron?.trim() === '* * * * *') {
		return await rotateStageCache();
	}

	log.warn(`Unknown cron expression: ${cron}`);
}