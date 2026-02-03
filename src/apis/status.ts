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
	
	// 使用 SQL API 查询 Analytics Engine
	// 数据结构: indexes[1] = region, doubles[1] = duration (ms), doubles[2] = success (1/0)
	const query = `
		SELECT
			toStartOfInterval(timestamp, INTERVAL '15' MINUTE) as time_bucket,
			MIN(double1) as min_duration,
			MAX(double1) as max_duration,
			AVG(double1) as avg_duration,
			stddevPop(double1) as std_dev,
			AVG(double2) as success_rate,
			COUNT(*) as count
		FROM analytics
		WHERE timestamp >= NOW() - INTERVAL '1' DAY
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
			console.warn('Missing ACCOUNT_ID or ANALYTICS_API_TOKEN environment variables, using mock data');
			console.warn('To enable real data, add these to wrangler.jsonc:');
			console.warn('[vars]');
			console.warn('ACCOUNT_ID = "your-account-id"');
			console.warn('ANALYTICS_API_TOKEN = "your-api-token"');
			// 返回模拟数据以便测试
			return generateMockData();
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
			return generateMockData();
		}

		const data = await response.json<any>();
		
		// 解析并转换数据
		if (!data.data || !Array.isArray(data.data)) {
			console.warn('Unexpected response format from Analytics Engine');
			return generateMockData();
		}

		return data.data.map((row: any) => ({
			timestamp: new Date(row.time_bucket).getTime(),
			timeGroup: row.time_bucket,
			minDuration: row.min_duration || 0,
			maxDuration: row.max_duration || 0,
			avgDuration: row.avg_duration || 0,
			stdDev: row.std_dev || 0,
			successRate: row.success_rate || 0,
			count: row.count || 0,
		}));

	} catch (error) {
		console.error('Error querying Analytics Engine:', error);
		return generateMockData();
	}
}

/**
 * 生成模拟数据用于测试
 */
function generateMockData(): StatusDataPoint[] {
	const now = Date.now();
	const data: StatusDataPoint[] = [];
	const fifteenMinutes = 15 * 60 * 1000;

	// 生成最近24小时的数据，每15分钟一个点，降序排列（与SQL查询保持一致）
	for (let i = 0; i <= 96; i++) {
		const timestamp = now - i * fifteenMinutes;
		const date = new Date(timestamp);
		
		// 模拟数据：响应时间在 50-500ms 之间波动
		const baseLatency = 150;
		const variance = 100;
		const minDuration = baseLatency + (Math.random() - 0.5) * variance;
		const maxDuration = minDuration + Math.random() * 200;
		const avgDuration = (minDuration + maxDuration) / 2;
		const stdDev = (maxDuration - minDuration) / 4;
		
		data.push({
			timestamp,
			timeGroup: date.toISOString(),
			minDuration: Math.round(minDuration),
			maxDuration: Math.round(maxDuration),
			avgDuration: Math.round(avgDuration),
			stdDev: Math.round(stdDev),
			successRate: 0.95 + Math.random() * 0.05,
			count: 5, // 每次测试5个奇域
		});
	}

	return data;
}
