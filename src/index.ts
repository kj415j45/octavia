import { getStageInfo } from './apis/stage_info';
import { Global } from './global';
import octavia, { Regions } from './octavia';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		Global.setEnv(env);
		Global.setCtx(ctx);
		if(request.method === 'OPTIONS'){
			return new Response(null, { headers: corsHeaders });
		}
		const url = new URL(request.url);
		if (url.pathname.startsWith('/api/') && request.method === 'GET') {
			const endpoint = url.pathname.replace('/api/', '');
			switch (endpoint) {
				case 'test': {
					return new Response('API is working!');
				}
				case 'stage': {
					const region = url.searchParams.get('region') || '';
					const stageId = url.searchParams.get('id') || '';
					const data = await getStageInfo(region, stageId);
					return JSONResponse(data);
				}
				case 'bonus': {
					const hash = url.searchParams.get('hash') || '';
					const data = await env.kv.get(hash);
					return TextResponse(data || '');
				}
				default: {
					return new Response('API endpoint not found', { status: 404 });
				}
			}
		}

		return new Response('not found', { status: 404 });
	},

	async scheduled(controller, env, ctx) {
		Global.setEnv(env);
		Global.setCtx(ctx);

		const region = Regions.CN_GF;
		const stageIds = ['7257388309', '11342092235', '7042697842', '32913306460', '24195383780'];

		// 测试每个奇域并记录用时
		for (const stageId of stageIds) {
			const startTime = Date.now();
			let success = true;
			let errorMsg = '';
			
			try {
				await octavia.getStageInfo(region, stageId);
			} catch (error: any) {
				success = false;
				errorMsg = error.message || 'Unknown error';
				console.error(`Failed to query stage ${stageId}:`, error);
			}
			
			const duration = Date.now() - startTime;
			
			// 写入 Analytics Engine
			env.analytics.writeDataPoint({
				indexes: [`${region}-${stageId}`],
				doubles: [duration, success ? 1 : 0],
				blobs: [success ? '' : errorMsg]
			});
		}
	}
} satisfies ExportedHandler<Env>;

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
	'Access-Control-Max-Age': '86400',
};

function TextResponse(text: string, init: ResponseInit = {}): Response {
	return new Response(text, {
		...init,
		headers: {
			'Content-Type': 'text/plain',
			...corsHeaders,
			...(init.headers || {}),
		},
	});
}

function JSONResponse(data: any, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(data), {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...corsHeaders,
			...(init.headers || {}),
		},
	});
}
