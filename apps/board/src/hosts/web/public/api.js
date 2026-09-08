export const apiUrl = path => new URL(path, document.baseURI);
export async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(apiUrl(path), {
    method, cache: "no-store",
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  let value;
  try { value = await response.json(); }
  catch { throw new Error(`服务器未返回有效 JSON（HTTP ${response.status}）`); }
  if (!response.ok || value?.ok === false) throw new Error(value?.error || `请求失败（HTTP ${response.status}）`);
  return value;
}
export const readState = () => request("api/state");
export const readEvents = () => request("api/events");
export const createTask = body => request("api/tasks", { method: "POST", body });
export const updateTask = (id, body) => request(`api/tasks/${encodeURIComponent(id)}`, { method: "PATCH", body });
export const deleteTask = id => request(`api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
