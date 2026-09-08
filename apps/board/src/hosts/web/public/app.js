import { $, emptyState, showError } from "./dom.js";
import { readState } from "./api.js";
import { store, states } from "./state.js";
import { render } from "./render.js";
import { createEditor } from "./editor.js";
import { createEventPanel } from "./events.js";
const events = createEventPanel();
const editor = createEditor(() => store.tasks, change => {
  if (change.deletedId) store.tasks = store.tasks.filter(task => task.id !== change.deletedId);
  else {
    const index = store.tasks.findIndex(task => task.id === change.task.id);
    if (index === -1) store.tasks.push(change.task);
    else store.tasks[index] = change.task;
  }
  store.loaded = true; redraw(); void refresh();
});
const edit = task => editor.open(task), create = defaults => editor.open(undefined, defaults);
const redraw = () => { if (store.loaded) render(edit, create); };
let refreshing = false, refreshAgain = false;
async function refresh() {
  if (refreshing) { refreshAgain = true; return; }
  refreshing = true; $("#refresh-button").disabled = true;
  $("#content").setAttribute("aria-busy", "true"); showError($("#load-error"));
  $("#sync-status").textContent = "正在同步…";
  try {
    const data = await readState();
    if (!Array.isArray(data.tasks)) throw new Error("任务响应格式不正确。");
    store.tasks = data.tasks; store.counts = data.counts; store.loaded = true;
    redraw(); $("#sync-status").textContent = "已同步 · " + new Date().toLocaleTimeString("zh-CN", { hour12: false });
    events.refreshIfOpen();
  } catch (error) {
    showError($("#load-error"), error); $("#sync-status").textContent = "同步失败，可点击刷新重试";
    if (!store.loaded) $("#content").replaceChildren(emptyState("暂时无法读取任务", "请检查连接，然后点击刷新。"));
  } finally {
    refreshing = false; $("#refresh-button").disabled = false;
    $("#content").setAttribute("aria-busy", "false");
    if (refreshAgain) { refreshAgain = false; void refresh(); }
  }
}
for (const state of states) $("#state-filter").add(new Option(state.label, state.id));
for (const tab of document.querySelectorAll("[data-view]")) tab.addEventListener("click", () => {
  store.view = tab.dataset.view; redraw();
});
$("#search").addEventListener("input", event => { store.query = event.target.value; redraw(); });
$("#state-filter").addEventListener("change", event => { store.state = event.target.value; redraw(); });
$("#create-button").addEventListener("click", () => create());
$("#refresh-button").addEventListener("click", refresh);
void refresh();
