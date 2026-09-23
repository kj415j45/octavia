import { Global } from '../global';

export async function getAuthorInfo(id: string) {
	const db = Global.getEnv().DB;

	// 规范化uid：如果没有前缀，自动添加m前缀并尝试
	let uid = `${id}`.trim();
	if (uid === '0' || uid === '' || uid === 'null' || uid === 'undefined') {
		throw new Error(`Invalid author ID: ${id}`);
	}
	let hasPrefix = id.startsWith('m') || id.startsWith('h');
	let ingameUid: string | null = null;
	// 当ingame_uid对应的所有奇域都没有aid（uid为null）时，走此回退分支返回仅含游戏内信息的作者对象
	let gameOnlyFallback: { avatar: string | null; name: string | null } | null = null;

	// x前缀表示游戏内uid，通过stage_cache反查对应的账号uid
	if (id.startsWith('x')) {
		ingameUid = id.substring(1);
		// created_at在缓存刷新时不变，用expires_at（每次刷新都会更新）取最近一次更新的记录
		const row = await db
			.prepare('SELECT uid, data FROM stage_cache WHERE ingame_uid = ? ORDER BY expires_at DESC LIMIT 1')
			.bind(ingameUid)
			.first();
		if (!row) {
			throw new Error(`Author not found: ${id}`);
		}
		if (row.uid) {
			uid = row.uid as string;
			hasPrefix = true;
		} else {
			const game = JSON.parse(row.data as string)?.author?.game ?? null;
			gameOnlyFallback = { avatar: game?.avatar ?? null, name: game?.name ?? null };
		}
	} else if (!hasPrefix) {
		// 没有前缀，先尝试m前缀
		uid = `m${id}`;
	}

	// 查询作者信息
	let author = gameOnlyFallback ? null : await db.prepare('SELECT uid, avatar, name, ingame_name, pendant FROM author WHERE uid = ?').bind(uid).first();

	// 如果没找到且原始输入没有前缀，尝试h前缀
	if (!author && !hasPrefix && !gameOnlyFallback) {
		uid = `h${id}`;
		author = await db.prepare('SELECT uid, avatar, name, ingame_name, pendant FROM author WHERE uid = ?').bind(uid).first();
	}

	if (!author && !gameOnlyFallback) {
		throw new Error(`Author not found: ${id}`);
	}

	// 查询作者的奇域列表，按 guid（stage_id）数值升序以体现 seq 顺序
	// 若按游戏内uid查询，仅返回该uid对应的奇域，而非该作者账号下的全部奇域
	const stages = ingameUid
		? await db
				.prepare('SELECT region, stage_id FROM stage_cache WHERE ingame_uid = ? ORDER BY CAST(stage_id AS INTEGER) ASC')
				.bind(ingameUid)
				.all()
		: await db
				.prepare('SELECT region, stage_id FROM stage_cache WHERE uid = ? ORDER BY CAST(stage_id AS INTEGER) ASC')
				.bind(uid)
				.all();

	if (gameOnlyFallback) {
		return {
			uid: null,
			avatar: gameOnlyFallback.avatar,
			name: null,
			ingameName: gameOnlyFallback.name,
			pendant: null,
			stages: stages.results.map((s: any) => ({
				region: s.region,
				stageId: s.stage_id,
			})),
		};
	}

	if (!author) {
		throw new Error(`Author not found: ${id}`);
	}

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
