import { Global } from '../global';

const PAGE_SIZE = 8;
const FETCH_SIZE = PAGE_SIZE + 1;

type SearchRow = {
	region: string;
	stage_id: string;
};

function parsePositiveInt(value: string | null, fallback: number) {
	const parsed = Number.parseInt(value || '', 10);
	if (!Number.isFinite(parsed) || parsed < 1) {
		return fallback;
	}
	return parsed;
}

export async function searchStages(keyword: string, pageParam: string | null) {
	const db = Global.getEnv().DB;
	const query = keyword.trim();
	if (!query) {
		throw new Error('Search keyword is required');
	}
	const page = parsePositiveInt(pageParam, 1);
	const offset = (page - 1) * PAGE_SIZE;
	const result = await db
		.prepare(
			`SELECT region, stage_id
			 FROM stage_cache
			 WHERE name LIKE '%' || REPLACE(REPLACE(REPLACE(?, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%' ESCAPE '\\' COLLATE NOCASE
			 ORDER BY stage_id DESC
			 LIMIT ? OFFSET ?`,
		)
		.bind(query, FETCH_SIZE, offset)
		.all<SearchRow>();
	const rows = result.results || [];
	const nextPage = rows.length > PAGE_SIZE;

	return {
		next_page: nextPage,
		results: rows.slice(0, PAGE_SIZE).map((row) => ({
			region: row.region,
			stage_id: row.stage_id,
		})),
	};
}