export function taggedLogger(tag: string) {
	return {
		log: (...args: any[]) => console.log(`[${tag}]`, ...args),
		info: (...args: any[]) => console.info(`[${tag}]`, ...args),
		error: (...args: any[]) => console.error(`[${tag}]`, ...args),
		warn: (...args: any[]) => console.warn(`[${tag}]`, ...args),
		debug: (...args: any[]) => console.debug(`[${tag}]`, ...args),
	};
}
