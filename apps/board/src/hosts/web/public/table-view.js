import { el, button, badge } from "./dom.js";
import { formatTime } from "./dates.js";
import { taskMap } from "./state.js";
/** The Agent column is what makes this view an assignment table: who holds which node right now. */
export function tableView(tasks, allTasks, runs, onEdit) {
  const wrapper = el("div", "table-wrap"), table = el("table", "task-table"), lookup = taskMap(allTasks);
  table.setAttribute("aria-label", "Task table");
  const head = el("thead"), header = el("tr");
  for (const label of ["Task", "State", "Agent", "Parent", "Depends on", "Updated"]) {
    const cell = el("th", "", label); cell.scope = "col"; header.append(cell);
  }
  head.append(header); table.append(head);
  const body = el("tbody");
  for (const task of tasks) {
    const row = el("tr"), title = el("td", "table-title"), state = el("td");
    title.append(button(task.title, "task-link", () => onEdit(task)), el("div", "task-id", task.id));
    state.append(badge(task));
    const run = runs.get(task.id), agent = el("td", "table-agent");
    if (run) {
      agent.textContent = run.agentId;
      agent.dataset.running = "true";
      agent.title = `${run.kind} over ${run.channel}, since ${formatTime(run.startedAt)}`;
    } else agent.textContent = "—";
    const parent = el("td", "table-parent", task.parentId ? lookup.get(task.parentId)?.title ?? task.parentId : "—");
    const dependencies = el("td", "table-dependencies", task.dependsOn.length ? String(task.dependsOn.length) : "—");
    dependencies.title = task.dependsOn.map(id => lookup.get(id)?.title ?? id).join(", ");
    row.append(title, state, agent, parent, dependencies, el("td", "table-time", formatTime(task.updatedAt)));
    body.append(row);
  }
  table.append(body); wrapper.append(table);
  return wrapper;
}
