import { getStageInfo } from './stage_info';
import { updateLeaderboard } from '../scheduled';
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
