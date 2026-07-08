import { getStageInfo } from './stage_info';
import { updateLeaderboard, ROTATE_BATCH_SIZE } from '../scheduled';
import { Regions } from '../octavia';
import { Global } from '../global';
import { taggedLogger } from '../logger';

const logger = taggedLogger('api:maintain');

// ── TOTP (RFC 6238 / HOTP RFC 4226) ──────────────────────────────────────────

function base32Decode(input: string): Uint8Array {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
	let bits = 0, value = 0;
	const output: number[] = [];
	for (const char of clean) {
		const idx = alphabet.indexOf(char);
		if (idx === -1) throw new Error(`Invalid base32 character: ${char}`);
		value = (value << 5) | idx;
		bits += 5;
		if (bits >= 8) {
			output.push((value >>> (bits - 8)) & 0xff);
			bits -= 8;
		}
	}
	return new Uint8Array(output);
}

async function generateHotp(secretBytes: Uint8Array, counter: number): Promise<string> {
	const counterBytes = new Uint8Array(8);
	let c = counter;
	for (let i = 7; i >= 0; i--) {
		counterBytes[i] = c & 0xff;
		c = Math.floor(c / 256);
	}
	const key = await crypto.subtle.importKey(
		'raw',
		secretBytes,
		{ name: 'HMAC', hash: 'SHA-1' },
		false,
		['sign'],
	);
	const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes));
	const offset = sig[sig.length - 1] & 0x0f;
	const code =
		((sig[offset] & 0x7f) << 24) |
		((sig[offset + 1] & 0xff) << 16) |
		((sig[offset + 2] & 0xff) << 8) |
		(sig[offset + 3] & 0xff);
	return (code % 1_000_000).toString().padStart(6, '0');
}

async function verifyTotp(secret: string, token: string): Promise<boolean> {
	const secretBytes = base32Decode(secret);
	const counter = Math.floor(Date.now() / 1000 / 30);
	// ±2 步 = ±60 秒窗口
	for (let delta = -2; delta <= 2; delta++) {
		const expected = await generateHotp(secretBytes, counter + delta);
		if (expected === token) return true;
	}
	return false;
}

// ── 请求处理 ──────────────────────────────────────────────────────────────────

export async function handleMaintain(request: Request): Promise<Response> {
	const env = Global.getEnv();

	let body: any;
	try {
		body = await request.json();
	} catch {
		return jsonError('Invalid JSON body', 400);
	}

	const totpSecret = env.TOTP_SECRET;
	if (!totpSecret) {
		return jsonError('TOTP not configured', 500);
	}

	const token = body?.totp;
	if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
		return jsonError('需要 6 位 TOTP 验证码', 401);
	}

	const valid = await verifyTotp(totpSecret, token);
	if (!valid) {
		return jsonError('验证码无效或已过期', 401);
	}

	const action = body?.action;

	switch (action) {
		case 'flush_cache': {
			const region = body.region as string;
			const stage_ids = body.stage_ids as string[];
			if (!region || !Array.isArray(stage_ids) || stage_ids.length === 0) {
				return jsonError('需要 region 和 stage_ids', 400);
			}
			const validRegions = Object.values(Regions) as string[];
			if (!validRegions.includes(region)) {
				return jsonError(`无效的 region: ${region}`, 400);
			}

			const db = env.DB;
			const results: Array<{ stage_id: string; status: string }> = [];
			for (const stageId of stage_ids) {
				try {
					const result = await db
						.prepare(
							'UPDATE stage_cache SET expires_at = 0, rotate_at = 0 WHERE region = ? AND stage_id = ?',
						)
						.bind(region, stageId)
						.run();
					results.push({
						stage_id: stageId,
						status: result.meta.changes > 0 ? 'ok' : 'not_found',
					});
				} catch (e: any) {
					results.push({ stage_id: stageId, status: `error: ${e.message}` });
				}
			}

			// 后台触发重新拉取
			const ctx = Global.getCtx();
			ctx.waitUntil(
				Promise.allSettled(
					stage_ids.map((stageId) =>
						getStageInfo(region, stageId).catch((e) =>
							logger.warn(`后台刷新失败 ${region}/${stageId}:`, e),
						),
					),
				),
			);

			return jsonOk({ results });
		}

		case 'update_leaderboard': {
			try {
				await updateLeaderboard();
				return jsonOk({ message: '排行榜已更新' });
			} catch (e: any) {
				logger.error('排行榜更新失败:', e);
				return jsonError(`排行榜更新失败: ${e.message}`, 500);
			}
		}

		case 'get_kv': {
			const hash = body.hash as string;
			if (!hash || typeof hash !== 'string') return jsonError('需要 hash', 400);
			const value = await env.kv.get(hash);
			return jsonOk({ hash, value });
		}

		case 'set_kv': {
			const hash = body.hash as string;
			const value = body.value;
			if (!hash || typeof hash !== 'string') return jsonError('需要 hash', 400);
			if (value === undefined || value === null) return jsonError('需要 value', 400);
			await env.kv.put(hash, String(value));
			return jsonOk({ hash, message: 'KV 记录已保存' });
		}

		case 'search_author': {
			const query = body.query as string;
			if (!query || typeof query !== 'string' || query.trim() === '') {
				return jsonError('需要 query 参数', 400);
			}
			const db = env.DB;
			const pattern = `%${query.trim()}%`;
			const rows = await db
				.prepare(
					'SELECT uid, name, ingame_name, avatar FROM author WHERE ingame_name LIKE ? LIMIT 30',
				)
				.bind(pattern)
				.all();
			return jsonOk({ results: rows.results });
		}

		case 'inspect_stage_cache': {
			const region = body.region as string;
			const guid = body.guid as string | number;
			if (!region || typeof region !== 'string') {
				return jsonError('需要 region', 400);
			}
			if (guid === undefined || guid === null || String(guid).trim() === '') {
				return jsonError('需要 guid', 400);
			}
			const validRegions = Object.values(Regions) as string[];
			if (!validRegions.includes(region)) {
				return jsonError(`无效的 region: ${region}`, 400);
			}

			const stageId = String(guid).trim();
			const db = env.DB;
			const row = await db
				.prepare(
					`SELECT region, stage_id, uid, name, intro, description, good_rate, category, deleted, data, created_at, expires_at, rotate_at
					 FROM stage_cache
					 WHERE region = ? AND stage_id = ?
					 LIMIT 1`,
				)
				.bind(region, stageId)
				.first<{
					region: string;
					stage_id: string;
					uid: string | null;
					name: string | null;
					intro: string | null;
					description: string | null;
					good_rate: string | null;
					category: string | null;
					deleted: number;
					data: string;
					created_at: number;
					expires_at: number;
					rotate_at: number | null;
				}>();

			if (!row) {
				return jsonError('未找到该奇域缓存记录', 404);
			}

			let parsedData: unknown = null;
			try {
				parsedData = JSON.parse(row.data);
			} catch {
				parsedData = null;
			}

			return jsonOk({
				cache: row,
				parsed_data: parsedData,
			});
		}

		case 'stats': {
			const db = env.DB;
			const now = Math.floor(Date.now() / 1000);
			const metric = body.metric as string;

			switch (metric) {
				case 'total': {
					const res = await db.prepare('SELECT COUNT(*) AS c FROM stage_cache').first<{ c: number }>();
					return jsonOk({ metric, value: Number(res?.c ?? 0) });
				}

				case 'new_24h': {
					const dayAgo = now - 86400;
					const res = await db
						.prepare('SELECT COUNT(*) AS c FROM stage_cache WHERE created_at >= ?')
						.bind(dayAgo)
						.first<{ c: number }>();
					return jsonOk({ metric, value: Number(res?.c ?? 0) });
				}

				case 'rotate_backlog': {
					const res = await db
						.prepare('SELECT COUNT(*) AS c FROM stage_cache WHERE rotate_at <= ?')
						.bind(now)
						.first<{ c: number }>();
					const backlog = Number(res?.c ?? 0);
					// 滚动更新：Cron 每分钟处理 ROTATE_BATCH_SIZE 条
					const rate_per_minute = ROTATE_BATCH_SIZE;
					const eta_minutes = backlog > 0 ? Math.ceil(backlog / rate_per_minute) : 0;
					return jsonOk({
						metric,
						value: backlog,
						rate_per_minute,
						eta_minutes,
						eta_at: eta_minutes > 0 ? now + eta_minutes * 60 : 0,
					});
				}

				case 'deleted': {
					const res = await db
						.prepare('SELECT COUNT(*) AS deleted, (SELECT COUNT(*) FROM stage_cache) AS total FROM stage_cache WHERE deleted = 1')
						.first<{ deleted: number; total: number }>();
					const deleted = Number(res?.deleted ?? 0);
					const total = Number(res?.total ?? 0);
					return jsonOk({
						metric,
						value: deleted,
						total,
						percent: total > 0 ? (deleted / total) * 100 : 0,
					});
				}

				case 'authors': {
					const res = await db.prepare('SELECT COUNT(*) AS c FROM author').first<{ c: number }>();
					return jsonOk({ metric, value: Number(res?.c ?? 0) });
				}

				case 'by_region': {
					const rows = await db
						.prepare('SELECT region, COUNT(*) AS c FROM stage_cache GROUP BY region ORDER BY c DESC')
						.all();
					return jsonOk({ metric, rows: rows.results ?? [] });
				}

				case 'by_category': {
					const rows = await db
						.prepare(
							"SELECT COALESCE(category, '(未分类)') AS category, COUNT(*) AS c FROM stage_cache GROUP BY category ORDER BY c DESC",
						)
						.all();
					return jsonOk({ metric, rows: rows.results ?? [] });
				}

				default:
					return jsonError(`未知统计项: ${metric}`, 400);
			}
		}

		default:
			return jsonError(`未知操作: ${action}`, 400);
	}
}

function jsonOk(data: Record<string, unknown>): Response {
	return new Response(JSON.stringify({ ok: true, ...data }), {
		headers: { 'Content-Type': 'application/json' },
	});
}

function jsonError(message: string, status: number): Response {
	return new Response(JSON.stringify({ ok: false, error: message }), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}
