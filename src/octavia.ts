const defaultUA = 'Octavia/1.0.0 (kj415j45/octavia)';

export enum Regions {
	CN_GF = 'cn_gf01',
	CN_BILI = 'cn_qd01',
}

class Octavia {
	readonly userAgent: string;

	constructor(userAgent?: string) {
		this.userAgent = userAgent ?? defaultUA;
	}

	async getStageInfo(region: Regions, stageId: string) {
		const endpoint = 'https://bbs-api.miyoushe.com/community/ugc_community/web/api/level/full/info';
		const payload = {
			region,
			level_id: stageId,
			agg_req_list: [{ api_name: 'level_detail' }, { api_name: 'developer_info' }, { api_name: 'config' }],
		};
		const data = await this.request('POST', endpoint, {}, payload);
		const resp_map = data.data.resp_map;
		console.debug('Received stage info:', resp_map);
		const levelDetail = resp_map.level_detail.data.level_detail_response.level_info;
		const developerInfo = resp_map.developer_info.data.developer_news_response;
		const level = {
			region: region,
			id: stageId,
			meta: {
				name: levelDetail.level_name,
				description: levelDetail.desc,
				intro: levelDetail.level_intro,
				type: levelDetail.play_type,
				category: levelDetail.play_cate === 'LEVEL_CATE_LONG_TERM' ? '长线游玩' : '轻量趣味',
				tags: levelDetail.play_tags,
				players: {
					min: levelDetail.limit_play_num_min,
					max: levelDetail.limit_play_num_max,
					str: levelDetail.show_limit_play_num_str,
				},
				hotScore: levelDetail.hot_score,
				goodRate: levelDetail.good_rate,
				cover: {
					images: [levelDetail.cover_img.url, ...levelDetail.images.map((img: any) => img.url)],
					videoCover: levelDetail.video_info.video_cover,
					video: levelDetail.video_info.video_url,
				},
			},
			version: {
				latest: developerInfo.latest_update.version,
				updateInfo: developerInfo.latest_update.content,
				changelog: developerInfo.update_list,
			},
		};
		const author = {
			game: {
				avatar: developerInfo.developer.game_avatar,
				name: developerInfo.developer.game_nickname,
			},
			mys: {
				aid: developerInfo.developer.aid,
				avatar: developerInfo.developer.mys_user_info.avatar_url,
				name: developerInfo.developer.mys_user_info.nickname,
			},
		};
		return {
			author,
			level,
		};
	}

	protected async request(method: string, endpoint: string, query: Record<string, any>, payload: any): Promise<any> {
		const url = new URL(endpoint);
		Object.keys(query).forEach((key) => url.searchParams.append(key, query[key]));

		const response = await fetch(url.toString(), {
			method,
			headers: {
				'User-Agent': this.userAgent,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		});

		const jsonDoc = await response.json();

		return jsonDoc;
	}
}

export const octavia = new Octavia();
export default octavia;
