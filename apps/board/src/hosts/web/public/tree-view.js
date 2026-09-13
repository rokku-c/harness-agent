import { el, button, badge } from "./dom.js";
import { formatTime } from "./dates.js";
import { taskMap } from "./state.js";
export function treeView(tasks, allTasks, collapsed, runs, onEdit, redraw) {
  const container = el("div", "tree-view"), lookup = taskMap(allTasks);
  const matches = new Set(tasks.map(task => task.id)), included = new Set(matches);
  for (const task of tasks) {
    let parent = task.parentId;
    const seen = new Set([task.id]);
    while (parent && lookup.has(parent) && !seen.has(parent)) {
      seen.add(parent); included.add(parent); parent = lookup.get(parent).parentId;
    }
  }
  const nodes = allTasks.filter(task => included.has(task.id));
  const children = new Map();
  for (const task of nodes) {
    const key = included.has(task.parentId) ? task.parentId : undefined;
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(task);
  }
  const visited = new Set(), filtering = matches.size !== allTasks.length;
  function append(task, depth) {
    if (visited.has(task.id)) return;
    visited.add(task.id);
    const descendants = children.get(task.id) ?? [];
    const folded = !filtering && collapsed.has(task.id);
    const row = el("div", "tree-row");
    row.style.setProperty("--depth", Math.min(depth, 12));
    row.dataset.context = String(!matches.has(task.id));
    if (descendants.length) {
      const toggle = button(folded ? "▸" : "▾", "tree-toggle", () => {
        collapsed.has(task.id) ? collapsed.delete(task.id) : collapsed.add(task.id);
        redraw();
      });
      toggle.disabled = filtering;
      toggle.setAttribute("aria-label", `${folded ? "Expand" : "Collapse"} ${task.title}`);
      toggle.setAttribute("aria-expanded", String(!folded));
      row.append(toggle);
    } else row.append(el("span", "tree-leaf", "·"));
    const title = button(task.title, "task-link", () => onEdit(task));
    const active = runs.get(task.id);
    row.dataset.running = String(Boolean(active));
    const meta = el("div", "tree-meta");
    if (active) {
      const marker = el("span", "tree-running", `● ${active.agentId}`);
      marker.title = `${active.kind} over ${active.channel}, since ${formatTime(active.startedAt)}`;
      meta.append(marker);
    } else if (task.rollup?.interrupted) {
      const marker = el("span", "tree-interrupted", "◌ interrupted");
      marker.title = "A run here stopped without reporting; rerun it or cancel the node.";
      meta.append(marker);
    } else if (task.rollup && task.rollup.kind !== "leaf") {
      const progress = el("span", "tree-progress", `${Math.round(task.rollup.progress * 100)}%`);
      progress.title = `${task.rollup.doneLeaves} of ${task.rollup.leaves} leaves done`;
      meta.append(progress);
    }
    meta.append(el("span", "task-id", task.id), badge(task));
    row.append(title, meta); container.append(row);
    if (!folded) for (const child of descendants) append(child, depth + 1);
    else markHidden(task.id);
  }
  function markHidden(id) {
    for (const child of children.get(id) ?? []) if (!visited.has(child.id)) {
      visited.add(child.id); markHidden(child.id);
    }
  }
  for (const task of children.get(undefined) ?? []) append(task, 0);
  for (const task of nodes) if (!visited.has(task.id)) append(task, 0);
  return container;
}
