import { Global } from '../global';

const PAGE_SIZE = 80;
const FETCH_SIZE = PAGE_SIZE + 1;

type SearchRow = {
	region: string;
	stage_id: string;
};

export class InvalidSearchFieldsError extends Error {}

function parsePositiveInt(value: string | null, fallback: number) {
	const parsed = Number.parseInt(value || '', 10);
	if (!Number.isFinite(parsed) || parsed < 1) {
		return fallback;
	}
	return parsed;
}

export async function searchStages(keyword: string, pageParam: string | null, fieldsParam: string | null = null) {
	const db = Global.getEnv().DB;
	const query = keyword.trim();
	if (!query) {
		throw new Error('Search keyword is required');
	}
	const fields = (fieldsParam ?? 'name').split(',');
	if (fields.some((field) => !['name', 'intro', 'description'].includes(field))) {
		throw new InvalidSearchFieldsError('Search fields must be a non-empty selection of name, intro, description');
	}
	const page = parsePositiveInt(pageParam, 1);
	const offset = (page - 1) * PAGE_SIZE;
	const result = await db
		.prepare(
			`WITH search AS (
				SELECT '%' || REPLACE(REPLACE(REPLACE(?, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%' AS pattern
			 )
			 SELECT region, stage_id
			 FROM stage_cache CROSS JOIN search
			 WHERE (? AND name LIKE pattern ESCAPE '\\' COLLATE NOCASE)
			    OR (? AND intro LIKE pattern ESCAPE '\\' COLLATE NOCASE)
			    OR (? AND description LIKE pattern ESCAPE '\\' COLLATE NOCASE)
			 ORDER BY stage_id DESC
			 LIMIT ? OFFSET ?`,
		)
		.bind(
			query,
			Number(fields.includes('name')),
			Number(fields.includes('intro')),
			Number(fields.includes('description')),
			FETCH_SIZE,
			offset,
		)
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