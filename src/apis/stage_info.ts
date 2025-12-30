import octavia, { Regions } from '../octavia';

export async function getStageInfo(region: string, stageId: string) {
	const validRegions = Object.values(Regions);
    if (!validRegions.includes(region as Regions)) {
        throw new Error(`Invalid region: ${region}. Valid regions are: ${validRegions.join(', ')}`);
    }
	return octavia.getStageInfo(Regions[region as keyof typeof Regions], stageId);
}
