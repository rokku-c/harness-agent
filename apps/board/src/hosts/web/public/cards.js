import { el, button, badge } from "./dom.js";
import { formatTime } from "./dates.js";
export function taskCard(task, lookup, onEdit) {
  const card = button("", "task-card", () => onEdit(task));
  card.setAttribute("aria-label", `Edit task: ${task.title}`);
  const top = el("div", "card-top");
  top.append(el("span", "task-id", task.id), badge(task));
  card.append(top, el("h3", "task-title", task.title));
  if (task.body) card.append(el("p", "task-excerpt", task.body));
  const relations = el("div", "card-relations");
  if (task.parentId) {
    const parent = el("span", "relation", "↳ " + (lookup.get(task.parentId)?.title ?? task.parentId));
    parent.title = "Parent: " + (lookup.get(task.parentId)?.title ?? task.parentId);
    relations.append(parent);
  }
  if (task.dependsOn.length) {
    const deps = el("span", "relation", `${task.dependsOn.length} dependenc${task.dependsOn.length === 1 ? "y" : "ies"}`);
    deps.title = task.dependsOn.map(id => lookup.get(id)?.title ?? id).join(", ");
    relations.append(deps);
  }
  if (relations.childElementCount) card.append(relations);
  card.append(el("div", "card-footer", "Updated " + formatTime(task.updatedAt)));
  return card;
}
