import { getHeaders, getMethod, getUrlPath } from "h3";

export default eventHandler((event) => {
  return {
    url: getUrlPath(event),
    method: getMethod(event),
    headers: getHeaders(event),
  };
});
