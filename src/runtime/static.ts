import {
  eventHandler,
  createError,
  setResponseStatus,
  send,
  setHeader,
  removeResponseHeader,
  getMethod,
  getUrlPath,
  getHeader,
} from "h3";
import { joinURL, withoutTrailingSlash, withLeadingSlash, parseURL } from "ufo";
import {
  getAsset,
  readAsset,
  isPublicAssetURL,
} from "#internal/nitro/virtual/public-assets";

const METHODS = new Set(["HEAD", "GET"]);

const EncodingMap = { gzip: ".gz", br: ".br" };

export default eventHandler((event) => {
  if (getMethod(event) && !METHODS.has(getMethod(event))) {
    return;
  }

  let id = decodeURIComponent(
    withLeadingSlash(withoutTrailingSlash(parseURL(getUrlPath(event)).pathname))
  );
  let asset;

  const encodingHeader = String(getHeader(event, "accept-encoding") || "");
  const encodings = [
    ...encodingHeader
      .split(",")
      .map((e) => EncodingMap[e.trim()])
      .filter(Boolean)
      .sort(),
    "",
  ];
  if (encodings.length > 1) {
    setHeader(event, "Vary", "Accept-Encoding");
  }

  for (const encoding of encodings) {
    for (const _id of [id + encoding, joinURL(id, "index.html" + encoding)]) {
      const _asset = getAsset(_id);
      if (_asset) {
        asset = _asset;
        id = _id;
        break;
      }
    }
  }

  if (!asset) {
    if (isPublicAssetURL(id)) {
      removeResponseHeader(event, "cache-control");
      throw createError({
        statusMessage: "Cannot find static asset " + id,
        statusCode: 404,
      });
    }
    return;
  }

  const ifNotMatch = getHeader(event, "if-none-match") === asset.etag;
  if (ifNotMatch) {
    setResponseStatus(event, 304);
    send(event);
    return;
  }

  const ifModifiedSinceH = getHeader(event, "if-modified-since");
  const mtimeDate = new Date(asset.mtime);
  if (
    ifModifiedSinceH &&
    asset.mtime &&
    new Date(ifModifiedSinceH) >= mtimeDate
  ) {
    setResponseStatus(event, 304);
    send(event);
    return;
  }

  if (asset.type && !getHeader(event, "Content-Type")) {
    setHeader(event, "Content-Type", asset.type);
  }

  if (asset.etag && !getHeader(event, "ETag")) {
    setHeader(event, "ETag", asset.etag);
  }

  if (asset.mtime && !getHeader(event, "Last-Modified")) {
    setHeader(event, "Last-Modified", mtimeDate.toUTCString());
  }

  if (asset.encoding && !getHeader(event, "Content-Encoding")) {
    setHeader(event, "Content-Encoding", asset.encoding);
  }

  if (asset.size > 0 && !getHeader(event, "Content-Length")) {
    setHeader(event, "Content-Length", asset.size);
  }

  return readAsset(id);
});
