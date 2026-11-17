import { Global } from '../global';

export async function getRandomStageGuid(): Promise<string | null> {
	const end = Math.floor(Date.now() / 1000) + Global.CACHE_TTL;
	const window = Math.random() < 0.67 ? 7 * 24 * 3600 : Global.ROTATE_INTERVAL;
	const start = end - window;
	const time = start + Math.floor(Math.random() * (window + 1));

	const db = Global.getEnv().DB;
	let { results } = await db
		.prepare(
			'SELECT stage_id AS guid FROM stage_cache WHERE deleted = 0 AND expires_at <= ? ORDER BY expires_at DESC LIMIT 5',
		)
		.bind(time)
		.all<{ guid: string }>();

	if (results.length === 0) {
		({ results } = await db
			.prepare(
				'SELECT stage_id AS guid FROM stage_cache WHERE deleted = 0 AND expires_at > ? ORDER BY expires_at ASC LIMIT 5',
			)
			.bind(time)
			.all<{ guid: string }>());
	}

	if (results.length === 0) {
		return null;
	}
	return results[Math.floor(Math.random() * results.length)].guid;
}
