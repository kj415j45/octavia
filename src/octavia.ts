const defaultUA = 'Octavia/1.0.0 (kj415j45/octavia)';

export enum Regions {
	CN_GF = 'cn_gf01',
	CN_BILI = 'cn_qd01',

	GLB_AS = 'os_asia',
	GLB_EU = 'os_euro',
	GLB_NA = 'os_usa',

	
}

class Octavia {
	readonly userAgent: string;

	constructor(userAgent?: string) {
		this.userAgent = userAgent ?? defaultUA;
	}

	protected getEndpoint(region: Regions) {
		switch (region) {
			case Regions.CN_GF:
			case Regions.CN_BILI:
				return 'https://bbs-api.miyoushe.com/community/ugc_community/web/api/level/full/info';
			case Regions.GLB_NA:
			case Regions.GLB_EU:
			case Regions.GLB_AS:
				return 'https://bbs-api-os.hoyolab.com/community/ugc_community/web/api/level/full/info';
			default:
				throw new Error(`Unsupported region: ${region}`);
		}
	}

	async getStageInfo(region: Regions, stageId: string) {
		const endpoint = this.getEndpoint(region);
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
				category: this.parseStageCategory(levelDetail.play_cate),
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
		const mysInfo = developerInfo.developer.mys_user_info;
		const hylInfo = developerInfo.developer.hyl_user_info;
		const author = {
			game: {
				avatar: this.getValidAvatar(developerInfo.developer.game_avatar),
				name: developerInfo.developer.game_nickname,
			},
			mys: {
				aid: developerInfo.developer.aid,
				avatar: this.getValidAvatar(mysInfo?.avatar_url),
				name: mysInfo?.nickname,
			},
			hyl: {
				aid: developerInfo.developer.aid,
				avatar: this.getValidAvatar(hylInfo?.avatar_url),
				pedant: hylInfo?.pedant,
				name: hylInfo?.nickname,
			}
		};
		return {
			author,
			level,
		};
	}

	protected getValidAvatar(avatar: string) {
		const mysDefaultAvatar = 'https://bbs-static.miyoushe.com/upload/op_manual_upload/ugc_community/1769653604473developer_default_avatar.png';
		const hylDefaultAvatar = 'https://fastcdn.hoyoverse.com/static-resource-v2/2026/02/03/d82e8dcf18900bc983428acc1e4961d2_279538261314927397.png';
		if (!avatar || avatar === mysDefaultAvatar || avatar === hylDefaultAvatar) {
			return null;
		}
		return avatar;
	}

	protected parseStageCategory(category: string) {
		switch (category) {
			case 'LEVEL_CATE_LONG_TERM':
				return '长线游玩';
			case 'LEVEL_CATE_QUICK_EXPERIENCE':
				return '轻量趣味';
			default:
				return category;
		}
	}

	protected async request(method: string, endpoint: string, query: Record<string, any>, payload: any): Promise<any> {
		const url = new URL(endpoint);
		Object.keys(query).forEach((key) => url.searchParams.append(key, query[key]));

		try {
			const response = await fetch(url.toString(), {
				method,
				headers: {
					'User-Agent': this.userAgent,
					'Content-Type': 'application/json',
					'X-Rpc-Language': 'zh-cn',
				},
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(3000),
			});

			const jsonDoc = await response.json();

			return jsonDoc;
		} catch (error) {
			console.error('Request error:', error);
			throw error;
		}
	}
}

export const octavia = new Octavia();
export default octavia;
