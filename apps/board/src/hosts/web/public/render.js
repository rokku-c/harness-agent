import { $, el, emptyState } from "./dom.js";
import { store, visibleTasks, viewNames } from "./state.js";
import { boardView } from "./board-view.js";
import { treeView } from "./tree-view.js";
import { tableView } from "./table-view.js";
export function render(onEdit, onCreate) {
  const tasks = visibleTasks(), summary = $("#summary");
  const counts = Object.fromEntries(["todo", "doing", "blocked", "done", "cancelled"].map(state =>
    [state, store.tasks.filter(task => task.state === state).length]));
  summary.replaceChildren();
  for (const [label, value, detail, kind] of [
    ["全部任务", store.tasks.length, "所有状态的任务", "total"],
    ["进行中", counts.doing, "正在推进的工作", "doing"],
    ["受阻任务", counts.blocked, "需要关注与跟进", "blocked"],
    ["已完成", counts.done, "每一步进展都值得记录", "done"],
  ]) {
    const item = el("div", "summary-item"); item.dataset.kind = kind;
    item.append(el("span", "summary-label", label), el("strong", "summary-value", value), el("span", "summary-detail", detail));
    summary.append(item);
  }
  $("#view-title").textContent = viewNames[store.view];
  $("#result-count").textContent = `${tasks.length} 项任务`;
  for (const tab of document.querySelectorAll("[data-view]")) {
    if (tab.dataset.view === store.view) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  }
  let view;
  if (!store.tasks.length) view = emptyState("从第一项任务开始", "把目标拆解为具体任务，让进度一目了然。", () => onCreate());
  else if (!tasks.length) view = emptyState("没有匹配的任务", "试试其他关键词，或选择全部状态。");
  else if (store.view === "tree") view = treeView(tasks, store.tasks, store.collapsed, onEdit, () => render(onEdit, onCreate));
  else if (store.view === "table") view = tableView(tasks, store.tasks, onEdit);
  else view = boardView(tasks, store.tasks, onEdit, onCreate);
  $("#content").replaceChildren(view);
}
