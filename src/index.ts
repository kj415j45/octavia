import { Env } from "../worker-configuration";

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname.startsWith("/api/")) {
			const endpoint = url.pathname.replace("/api/", "");
			switch(endpoint) {
				case "test": {
					return new Response("API is working!");
				}
			}
		}
		return new Response("API endpoint not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;
