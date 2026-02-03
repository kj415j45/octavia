import { Global } from '../global';

export interface StatusDataPoint {
	timestamp: number; // Unix timestamp in milliseconds
	timeGroup: string; // ISO 8601 formatted time for display
	minDuration: number;
	maxDuration: number;
	avgDuration: number;
	stdDev: number;
	successRate: number;
	count: number;
}

/**
 * 查询最近1天的状态数据，聚合到15分钟粒度
 */
export async function getStatusData(): Promise<StatusDataPoint[]> {
	const env = Global.getEnv();

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
	
	// 使用 SQL API 查询 Analytics Engine
	// 数据结构: indexes[1] = region, doubles[1] = duration (ms), doubles[2] = success (1/0)
	const query = `
		SELECT
			toStartOfInterval(timestamp, INTERVAL '15' MINUTE) as time_bucket,
			MIN(double1) as min_duration,
			MAX(double1) as max_duration,
			AVG(double1) as avg_duration,
			SUM(double1 * double1) as sum_of_squares,
			SUM(double1) as sum_duration,
			AVG(double2) as success_rate,
			COUNT() as count
		FROM octavia
		WHERE
            timestamp >= toDateTime(${Math.floor(oneDayAgo / 1000)})
            AND timestamp <= toDateTime(${Math.floor(now / 1000)})
		GROUP BY time_bucket
		ORDER BY time_bucket DESC
	`;

	try {
		// 构建 SQL API 请求
		// 注意：需要在 wrangler.jsonc 中配置环境变量:
		// [vars]
		// ACCOUNT_ID = "your-account-id"
		// ANALYTICS_API_TOKEN = "your-api-token"
		const accountId = env.ACCOUNT_ID || '';
		const apiToken = env.ANALYTICS_API_TOKEN || '';
		
		if (!accountId || !apiToken) {
            console.error('ACCOUNT_ID or ANALYTICS_API_TOKEN is not set.');
			return [];
		}

		const sqlUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;
		
		const response = await fetch(sqlUrl, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiToken}`,
			},
			body: query,
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Analytics Engine SQL query failed:', response.status, errorText);
			return [];
		}

		const data = await response.json<any>();
		
		// 解析并转换数据
		if (!data.data || !Array.isArray(data.data)) {
			console.warn('Unexpected response format from Analytics Engine');
			return [];
		}

		return data.data.map((row: any) => {
			const count = row.count || 0;
			const sumOfSquares = row.sum_of_squares || 0;
			const avgDuration = row.avg_duration || 0;
			
			// 计算标准差：σ = √(E[X²] - E[X]²) = √(sum_of_squares/count - avg²)
			const variance = count > 0 ? (sumOfSquares / count - avgDuration * avgDuration) : 0;
			const stdDev = variance > 0 ? Math.sqrt(variance) : 0;
			
			return {
				timestamp: new Date(row.time_bucket).getTime(),
				timeGroup: row.time_bucket,
				minDuration: row.min_duration || 0,
				maxDuration: row.max_duration || 0,
				avgDuration,
				stdDev,
				successRate: row.success_rate || 0,
				count,
			};
		});

	} catch (error) {
		console.error('Error querying Analytics Engine:', error);
		return [];
	}
}
