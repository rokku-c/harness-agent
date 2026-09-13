import { $, el, emptyState } from "./dom.js";
import { addMonths } from "./dates.js";
import { displayState, store, visibleTasks, viewNames } from "./state.js";
import { boardView } from "./board-view.js";
import { treeView } from "./tree-view.js";
import { tableView } from "./table-view.js";
import { calendarView } from "./calendar-view.js";
import { docView } from "./doc-view.js";
export function render(onEdit, onCreate, redraw) {
  const tasks = visibleTasks(), summary = $("#summary"), documents = store.view === "documents";
  const counts = Object.fromEntries(["todo", "doing", "blocked", "done", "cancelled"].map(state =>
    [state, store.tasks.filter(task => displayState(task) === state).length]));
  summary.replaceChildren();
  for (const [label, value, detail, kind] of [
    ["All tasks", store.tasks.length, "Across every state", "total"],
    ["Doing", counts.doing, "Work in progress", "doing"],
    ["Blocked", counts.blocked, "Needs attention", "blocked"],
    ["Done", counts.done, "Completed work", "done"],
  ]) {
    const item = el("div", "summary-item"); item.dataset.kind = kind;
    item.append(el("span", "summary-label", label), el("strong", "summary-value", value), el("span", "summary-detail", detail));
    summary.append(item);
  }
  $("#view-title").textContent = viewNames[store.view];
  // task counts and task filters say nothing about an outline
  summary.hidden = documents; $(".filters").hidden = documents;
  $("#result-count").textContent = documents
    ? `${store.documents.length} outline${store.documents.length === 1 ? "" : "s"}`
    : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`;
  for (const tab of document.querySelectorAll("[data-view]")) {
    if (tab.dataset.view === store.view) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  }
  let view;
  if (documents) view = docView(redraw);
  else if (!store.tasks.length) view = emptyState("Start with one task", "Break the goal into concrete tasks so progress is visible.", () => onCreate());
  else if (!tasks.length) view = emptyState("No matching tasks", "Try another keyword, or clear the state filter.");
  else if (store.view === "tree") view = treeView(tasks, store.tasks, store.collapsed, store.runs, onEdit, redraw);
  else if (store.view === "table") view = tableView(tasks, store.tasks, store.runs, onEdit);
  else if (store.view === "calendar") view = calendarView(tasks, store.month, onEdit, onCreate, step => {
    store.month = step === 0 ? new Date() : addMonths(store.month, step);
    redraw();
  });
  else view = boardView(tasks, store.tasks, onEdit, onCreate);
  $("#content").replaceChildren(view);
}
