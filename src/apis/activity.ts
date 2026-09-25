import { Global } from '../global';

type ActivityStageItem = [string, number];

interface ActivityStageData {
	items?: ActivityStageItem[];
}

export async function getActivityStageGuids(id: string): Promise<string[]> {
	const row = await Global.getEnv().DB
		.prepare('SELECT data FROM activity_stage_list WHERE activity_name = ?')
		.bind(id)
		.first<{ data: string }>();

	if (!row) {
		return [];
	}

	const data = JSON.parse(row.data) as ActivityStageData;
	return Array.isArray(data.items) ? data.items.map(([guid]) => guid) : [];
}