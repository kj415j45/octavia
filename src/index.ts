import { Env } from "../worker-configuration";
import { getStageInfo } from "./apis/stage_info";

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname.startsWith("/api/")) {
			const endpoint = url.pathname.replace("/api/", "");
			switch(endpoint) {
				case "test": {
					return new Response("API is working!");
				}
				case "stage": {
					const region = url.searchParams.get("region") || "";
					const stageId = url.searchParams.get("id") || "";
					const data = await getStageInfo(region, stageId);
					return new Response(JSON.stringify(data), {
						headers: { "Content-Type": "application/json" },
					});
				}
			}
		}
		return new Response("API endpoint not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;
