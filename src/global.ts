
export namespace Global {
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