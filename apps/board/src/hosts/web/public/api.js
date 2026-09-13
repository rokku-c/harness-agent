export const apiUrl = path => new URL(path, document.baseURI);
export async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(apiUrl(path), {
    method, cache: "no-store",
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  let value;
  try { value = await response.json(); }
  catch { throw new Error(`The server did not return valid JSON (HTTP ${response.status}).`); }
  if (!response.ok || value?.ok === false) throw new Error(value?.error || `Request failed (HTTP ${response.status}).`);
  return value;
}
export const readState = () => request("api/state");
export const readEvents = () => request("api/events");
export const readAgents = () => request("api/agents");
export const readRuns = () => request("api/runs");
export const createTask = body => request("api/tasks", { method: "POST", body });
export const updateTask = (id, body) => request(`api/tasks/${encodeURIComponent(id)}`, { method: "PATCH", body });
export const deleteTask = id => request(`api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
export const readDocuments = () => request("api/documents");
export const readDocument = id => request(`api/documents/${encodeURIComponent(id)}`);
export const createDocument = body => request("api/documents", { method: "POST", body });
export const deleteDocument = id => request(`api/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
/** One outline edit against the version the editor was built on. */
export const applyOp = (id, version, op) => request(`api/documents/${encodeURIComponent(id)}`, { method: "POST", body: { version, op } });
