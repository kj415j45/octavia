import { Fetcher } from "@cloudflare/workers-types/experimental";

declare namespace Cloudflare {
        interface GlobalProps {
                mainModule: typeof import("./src/index");
        }
        interface Env {
                PUBLIC: Fetcher;
        }
}
interface Env extends Cloudflare.Env {}
