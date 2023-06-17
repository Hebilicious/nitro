import "#internal/nitro/virtual/polyfill";
import type {
  Request as CFRequest,
  EventContext,
} from "@cloudflare/workers-types";
import { requestHasBody } from "#internal/nitro/utils";
import { nitroApp } from "#internal/nitro/app";
import { isPublicAssetURL } from "#internal/nitro/virtual/public-assets";

/**
 * Reference: https://developers.cloudflare.com/workers/runtime-apis/fetch-event/#parameters
 */

interface CFPagesEnv {
  ASSETS: { fetch: (request: CFRequest) => Promise<Response> };
  CF_PAGES: "1";
  CF_PAGES_BRANCH: string;
  CF_PAGES_COMMIT_SHA: string;
  CF_PAGES_URL: string;
  [key: string]: any;
}

export default {
  async fetch(
    request: CFRequest,
    env: CFPagesEnv,
    context: EventContext<CFPagesEnv, string, any>
  ) {
    const url = new URL(request.url);
    if (isPublicAssetURL(url.pathname)) {
      return env.ASSETS.fetch(request);
    }
    // Expose latest env to the global context
    globalThis.__env__ = env;
    return await nitroApp.localResponse(request as unknown as Request, {
      cf: request.cf,
      cloudflare: {
        request,
        env,
        context,
      },
    });
  },
};
