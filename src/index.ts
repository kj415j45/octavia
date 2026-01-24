import { getStageInfo } from './apis/stage_info';

export default {
	async fetch(request, env, ctx): Promise<Response> {
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
