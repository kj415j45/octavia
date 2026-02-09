import { Global } from '../global';

export async function getAuthorInfo(id: string) {
	const db = Global.getEnv().DB;
	
	// 规范化uid：如果没有前缀，自动添加m前缀并尝试
	let uid = `${id}`.trim();
    if(uid === '0' || uid === '' || uid === 'null' || uid === 'undefined') {
        throw new Error(`Invalid author ID: ${id}`);
    }
	let hasPrefix = id.startsWith('m') || id.startsWith('h');
	
	if (!hasPrefix) {
		// 没有前缀，先尝试m前缀
		uid = `m${id}`;
	}
	
	// 查询作者信息
	let author = await db
		.prepare('SELECT uid, avatar, name, ingame_name, pendant FROM author WHERE uid = ?')
		.bind(uid)
		.first();
	
	// 如果没找到且原始输入没有前缀，尝试h前缀
	if (!author && !hasPrefix) {
		uid = `h${id}`;
		author = await db
			.prepare('SELECT uid, avatar, name, ingame_name, pendant FROM author WHERE uid = ?')
			.bind(uid)
			.first();
	}
	
	if (!author) {
		throw new Error(`Author not found: ${id}`);
	}
	
	// 查询作者的奇域列表
	const stages = await db
		.prepare('SELECT region, stage_id FROM stage_cache WHERE uid = ? ORDER BY created_at DESC')
		.bind(uid)
		.all();
	
	return {
		uid: author.uid,
		avatar: author.avatar,
		name: author.name,
		ingameName: author.ingame_name,
		pendant: author.pendant,
		stages: stages.results.map((s: any) => ({
			region: s.region,
			stageId: s.stage_id,
		})),
	};
}
