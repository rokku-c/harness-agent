import { el, button, badge } from "./dom.js";
import { formatTime, taskMap } from "./state.js";
export function tableView(tasks, allTasks, onEdit) {
  const wrapper = el("div", "table-wrap"), table = el("table", "task-table"), lookup = taskMap(allTasks);
  table.setAttribute("aria-label", "任务列表");
  const head = el("thead"), header = el("tr");
  for (const label of ["任务", "状态", "父任务", "依赖", "更新时间"]) {
    const cell = el("th", "", label); cell.scope = "col"; header.append(cell);
  }
  head.append(header); table.append(head);
  const body = el("tbody");
  for (const task of tasks) {
    const row = el("tr"), title = el("td", "table-title"), state = el("td");
    title.append(button(task.title, "task-link", () => onEdit(task)), el("div", "task-id", task.id));
    state.append(badge(task.state));
    const parent = el("td", "table-parent", task.parentId ? lookup.get(task.parentId)?.title ?? task.parentId : "—");
    const dependencies = el("td", "table-dependencies", task.dependsOn.length ? `${task.dependsOn.length} 项依赖` : "—");
    dependencies.title = task.dependsOn.map(id => lookup.get(id)?.title ?? id).join("、");
    row.append(title, state, parent, dependencies, el("td", "table-time", formatTime(task.updatedAt)));
    body.append(row);
  }
  table.append(body); wrapper.append(table);
  return wrapper;
}
