import {
  eventHandler,
  H3Event,
  sendRedirect,
  setHeaders,
  proxyRequest,
  getUrlPath,
} from "h3";
import defu from "defu";
import { createRouter as createRadixRouter, toRouteMatcher } from "radix3";
import { joinURL, withQuery, getQuery, withoutBase } from "ufo";
import type { NitroRouteRules } from "nitropack";
import { useRuntimeConfig } from "./config";

const config = useRuntimeConfig();
const _routeRulesMatcher = toRouteMatcher(
  createRadixRouter({ routes: config.nitro.routeRules })
);

export function createRouteRulesHandler() {
  return eventHandler((event) => {
    console.log("Route rules handler ...");
    // Match route options against path
    const routeRules = getRouteRules(event);

    console.log("ROUTE RULES", routeRules);
    // Apply headers options
    if (routeRules.headers) {
      setHeaders(event, routeRules.headers);
    }
    // Apply redirect options
    if (routeRules.redirect) {
      console.log("SENDING REDIRECT");
      return sendRedirect(
        event,
        routeRules.redirect.to,
        routeRules.redirect.statusCode
      );
    }
    // Apply proxy options
    if (routeRules.proxy) {
      console.log("HAS PROXY", routeRules.proxy);
      let target = routeRules.proxy.to;
      if (target.endsWith("/**")) {
        let targetPath = event.path;
        const strpBase = (routeRules.proxy as any)._proxyStripBase;
        if (strpBase) {
          targetPath = withoutBase(targetPath, strpBase);
        }
        target = joinURL(target.slice(0, -3), targetPath);
      } else if (event.path.includes("?")) {
        const query = getQuery(event.path);
        target = withQuery(target, query);
      }
      console.log("PROXY RULES", routeRules.proxy);
      return proxyRequest(event, target, {
        fetch: $fetch.raw as any,
        ...routeRules.proxy,
      });
    }
  });
}

export function getRouteRules(event: H3Event): NitroRouteRules {
  event.context._nitro = event.context._nitro || {};
  if (!event.context._nitro.routeRules) {
    const path = new URL(getUrlPath(event), "http://localhost").pathname;
    console.log("PATH", path);
    event.context._nitro.routeRules = getRouteRulesForPath(
      withoutBase(path, useRuntimeConfig().app.baseURL)
    );
    console.log(event.context._nitro.routeRules);
  }
  return event.context._nitro.routeRules;
}

export function getRouteRulesForPath(path: string): NitroRouteRules {
  console.log(
    "GET ROUTE RULES FOR PATH",
    path,
    ..._routeRulesMatcher.matchAll(path)
  );
  return defu({}, ..._routeRulesMatcher.matchAll(path).reverse());
}
