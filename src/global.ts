export namespace Global {
	export const CACHE_TTL = 3600; // 1小时，单位：秒
	export const ROTATE_INTERVAL = CACHE_TTL * 8; // 滚动间隔：8倍缓存TTL

	var env: Env;
	var ctx: ExecutionContext;

	export function getEnv(): Env {
		return env;
	}

	export function setEnv(newEnv: Env): void {
		env = newEnv;
	}

	export function getCtx(): ExecutionContext {
		return ctx;
	}

	export function setCtx(newCtx: ExecutionContext): void {
		ctx = newCtx;
	}
}
