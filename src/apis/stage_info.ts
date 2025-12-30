import octavia, { Regions } from '../octavia';

export async function getStageInfo(region: string, stageId: string) {
	if (!(region in Regions)) {
		throw new Error(`Invalid region: ${region}`);
	}
	return octavia.getStageInfo(Regions[region as keyof typeof Regions], stageId);
}
