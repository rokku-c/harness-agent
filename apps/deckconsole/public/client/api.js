import { notice } from "./dom.js";
// Resolve from the served module URL, not the page path or a hard-coded port.
export const apiUrl = (path, moduleUrl = import.meta.url) => new URL(".." + path, moduleUrl);
export const api = async (path, opts) => {
  const r = await fetch(apiUrl(path), opts);
  let j = {}; try { j = await r.json(); } catch (e) { j = { ok: false, detail: "bad response" }; }
  if (!r.ok && !j.ok) notice(j.detail || ("HTTP " + r.status));
  return j;
};
export const post = (path, body) => api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
