import { Global } from '../global';
import { taggedLogger } from '../logger';

const logger = taggedLogger('api:leaderboard');

type LeaderboardRow = {
	category: string;
	rank_type: string;
	rank: number;
	region: string;
	stage_id: string;
	good_rate: string;
	name: string | null;
	uid: string | null;
};

export async function getLeaderboard() {
	const db = Global.getEnv().DB;

	const latest = await db
		.prepare('SELECT MAX(snapshot_at) as snapshot_at FROM goodrate_leaderboard')
		.first<{ snapshot_at: number | null }>();

	if (!latest?.snapshot_at) {
		return { snapshot_at: null, leaderboard: {} };
	}

	const snapshotAt = latest.snapshot_at;

	const rows = await db
		.prepare(
			'SELECT category, rank_type, rank, region, stage_id, good_rate, name, uid FROM goodrate_leaderboard WHERE snapshot_at = ? ORDER BY category, rank_type, rank ASC',
		)
		.bind(snapshotAt)
		.all<LeaderboardRow>();

	const leaderboard: Record<string, Record<string, Array<{
		rank: number;
		region: string;
		stage_id: string;
		good_rate: string;
		name: string | null;
		uid: string | null;
	}>>> = {};

	for (const row of rows.results || []) {
		if (!leaderboard[row.category]) {
			leaderboard[row.category] = {};
		}
		if (!leaderboard[row.category][row.rank_type]) {
			leaderboard[row.category][row.rank_type] = [];
		}
		leaderboard[row.category][row.rank_type].push({
			rank: row.rank,
			region: row.region,
			stage_id: row.stage_id,
			good_rate: row.good_rate,
			name: row.name,
			uid: row.uid,
		});
	}

	return { snapshot_at: snapshotAt, leaderboard };
}
