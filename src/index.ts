import { getStageInfo } from './apis/stage_info';
import { searchStages } from './apis/stage_search';
import { getStatusData } from './apis/status';
import { getAuthorInfo } from './apis/author';
import { runScheduled } from './scheduled';
import { Global } from './global';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		Global.setEnv(env);
		Global.setCtx(ctx);
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}
		try {
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
					case 'search/stage': {
						const keyword = url.searchParams.get('q') || '';
						if (!keyword.trim()) {
							return JSONResponse({ error: 'Search keyword is required' }, { status: 400 });
						}
						const page = url.searchParams.get('page');
						const data = await searchStages(keyword, page);
						return JSONResponse(data);
					}
					case 'bonus': {
						const hash = url.searchParams.get('hash') || '';
						const data = await env.kv.get(hash);
						return TextResponse(data || '');
					}
					case 'status': {
						const data = await getStatusData();
						return JSONResponse(data);
					}
					case 'author': {
						const id = url.searchParams.get('id') || '';
						const data = await getAuthorInfo(id);
						return JSONResponse(data);
					}
					default: {
						return new Response('API endpoint not found', { status: 404 });
					}
				}
			}

			return new Response('not found', { status: 404 });
		} catch (e) {
			return new Response(null, { status: 500 });
		}
	},

	async scheduled(controller, env, ctx) {
		Global.setEnv(env);
		Global.setCtx(ctx);

		await runScheduled();
	},
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
