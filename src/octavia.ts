const defaultUA = 'Octavia/1.0.0 (kj415j45/octavia)';

import { taggedLogger } from './logger';

const logger = taggedLogger('octavia');

export enum Regions {
	CN_GF = 'cn_gf01',
	CN_BILI = 'cn_qd01',

	CN_CHT = 'os_cht',

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
			case Regions.CN_CHT:
			case Regions.GLB_NA:
			case Regions.GLB_EU:
			case Regions.GLB_AS:
				return 'https://bbs-api-os.hoyolab.com/community/ugc_community/web/api/level/full/info';
			default:
				throw new Error(`Unsupported region: ${region}`);
		}
	}

	async getStageInfo(region: Regions, stageId: string) {
		if(!Object.values(Regions).includes(region)) {
			region = this.guidToRegion(stageId) ?? region;
		}

		const endpoint = this.getEndpoint(region);
		const payload = {
			region,
			level_id: stageId,
			agg_req_list: [{ api_name: 'level_detail' }, { api_name: 'developer_info' }, { api_name: 'reply_card' }, { api_name: 'config' }],
		};
		const data = await this.request('POST', endpoint, {}, payload);
		const resp_map = data.data.resp_map;
		logger.debug('Received stage info:', resp_map);

		if(resp_map.level_detail.retcode === StageNotFoundError.retcode){
			throw new StageNotFoundError(`Stage with ID ${stageId} not found in region ${region}`);
		}

		const levelDetail = resp_map.level_detail.data.level_detail_response.level_info;
		const developerInfo = resp_map.developer_info.data.developer_news_response;
		const replyCard = resp_map.reply_card.data.reply_card_response;

		const level = {
			region: levelDetail.region,
			id: levelDetail.level_id,
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
				comments: replyCard.reply_count,
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
		const gameUid = this.guidToUid(stageId)?.uid ?? null;
		const author = {
			game: {
				uid: gameUid,
				avatar: this.getValidAvatar(developerInfo.developer.game_avatar),
				name: developerInfo.developer.game_nickname,
			},
			mys: {
				aid: mysInfo?.aid || null,
				avatar: this.getValidAvatar(mysInfo?.avatar_url),
				name: mysInfo?.nickname || null,
			},
			hyl: {
				aid: hylInfo?.uid || null,
				avatar: this.getValidAvatar(hylInfo?.avatar_url),
				pendant: hylInfo?.pendant || null,
				name: hylInfo?.nickname || null,
			}
		};
		return {
			author,
			level,
		};
	}

	public guidToUid(guid: string | BigInt) {
		const GUID_MAGIC_NUMBER = 0x9C2BFB7Bn;

		try {
			const value = BigInt(guid.toString());
			const low32 = value & 0xFFFFFFFFn;
			const uid = BigInt.asUintN(32, low32 - GUID_MAGIC_NUMBER);
			const seq = value >> 32n;
			return { uid: Number(uid), seq: Number(seq) };
		} catch {
			return null;
		}
	}

	public uidToRegion(uid: string | number) {
		const value = uid.toString();
		if(value.length === 10) {
			if(value.startsWith('18')){
				return Regions.GLB_AS;
			}
		}

		if(value.length === 9) {
			const firstDigit = value[0];
			switch (firstDigit) {
				case '1':
				case '2':
				case '3':
				// case '4': // Not available for now
					return Regions.CN_GF;
				case '5':
					return Regions.CN_BILI;
				case '6':
					return Regions.GLB_NA
				case '7':
					return Regions.GLB_EU;
				case '8':
					return Regions.GLB_AS;
				case '9':
					return Regions.CN_CHT;
			}
		}
		return null;
	}

	public guidToRegion(guid: string | BigInt) {
		const uidInfo = this.guidToUid(guid);
		if(uidInfo) {
			return this.uidToRegion(uidInfo.uid);
		}
		return null;
	}

	protected getValidAvatar(avatar: string) {
		const knownDefaultAvatars = [
			'https://bbs-static.miyoushe.com/upload/op_manual_upload/ugc_community/1761034625041ugc_community_default_avatar.png',
			'https://bbs-static.miyoushe.com/upload/op_manual_upload/ugc_community/1769653604473developer_default_avatar.png',
			'https://fastcdn.hoyoverse.com/static-resource-v2/2026/02/03/d82e8dcf18900bc983428acc1e4961d2_279538261314927397.png',
		];

		if (!avatar || knownDefaultAvatars.includes(avatar)) {
			return null;
		}
		return avatar;
	}

	public getDefaultAvatar() {
		return 'https://bbs-static.miyoushe.com/upload/op_manual_upload/ugc_community/1769653604473developer_default_avatar.png';
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
			logger.error('Request error:', error);
			throw error;
		}
	}
}

export class StageNotFoundError extends Error {
	static readonly retcode = -2000431;
	constructor(message: string) {
		super(message);
		this.name = 'StageNotFoundError';
	}
}

export const octavia = new Octavia();
export default octavia;
