import { Global } from '../global';

export interface StatusDataPoint {
	timestamp: number; // Unix timestamp in milliseconds
	timeGroup: string; // ISO 8601 formatted time for display
	minDuration: number;
	maxDuration: number;
	avgDuration: number;
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
			MIN(if(double2 = 1, double1, 999999.0)) as min_duration,
			MAX(if(double2 = 1, double1, 0.0)) as max_duration,
			SUM(if(double2 = 1, double1, 0.0)) / SUM(double2) as avg_duration,
			AVG(double2) as success_rate,
			SUM(double2) as success_count,
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
			const successCount = row.success_count || 0;
			const hasSuccessfulRequests = successCount > 0;
			
			return {
				timestamp: new Date(row.time_bucket).getTime(),
				timeGroup: row.time_bucket,
				minDuration: hasSuccessfulRequests ? (row.min_duration || 0) : 0,
				maxDuration: hasSuccessfulRequests ? (row.max_duration || 0) : 0,
				avgDuration: hasSuccessfulRequests ? (row.avg_duration || 0) : 0,
				successRate: row.success_rate || 0,
				count: row.count || 0,
			};
		});

	} catch (error) {
		console.error('Error querying Analytics Engine:', error);
		return [];
	}
}
