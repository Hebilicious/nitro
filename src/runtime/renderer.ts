import {
  H3Event,
  eventHandler,
  getResponseStatus,
  getUrlPath,
  send,
  setHeader,
  setHeaders,
  setResponseStatus,
} from "h3";
import { useNitroApp } from "./app";

export interface RenderResponse {
  body: string;
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string>;
}

export type RenderHandler = (
  event: H3Event
) => Partial<RenderResponse> | Promise<Partial<RenderResponse>>;

export function defineRenderHandler(handler: RenderHandler) {
  return eventHandler(async (event) => {
    // TODO: Use serve-placeholder
    if (getUrlPath(event).endsWith("/favicon.ico")) {
      setHeader(event, "Content-Type", "image/x-icon");
      send(
        event,
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
      );
      return;
    }

    const response = await handler(event);
    if (!response) {
      setResponseStatus(
        event,
        getResponseStatus(event) === 200 ? 500 : getResponseStatus(event)
      );
      send(
        event,
        "No response returned from render handler: " + getUrlPath(event)
      );
      return;
    }

    // Allow hooking and modifying response
    const nitroApp = useNitroApp();
    await nitroApp.hooks.callHook("render:response", response, { event });

    // TODO: Warn if response is already handled

    // TODO: Caching support

    // Send headers
    if (response.headers) {
      setHeaders(event, response.headers);
      setResponseStatus(event, response.statusCode, response.statusMessage);
    }

    // Send response body
    return typeof response.body === "string"
      ? response.body
      : JSON.stringify(response.body);
  });
}
