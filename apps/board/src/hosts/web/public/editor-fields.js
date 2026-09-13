import { $, el } from "./dom.js";
import { formatTime, fromLocalInput, toLocalInput } from "./dates.js";
import { states, descendants } from "./state.js";
export function fillEditor(task, tasks, defaults) {
  const form = $("#task-form"), fields = form.elements;
  form.reset();
  fields.title.value = task?.title ?? "";
  fields.body.value = task?.body ?? "";
  fields.state.replaceChildren(...states.map(state => new Option(state.label, state.id)));
  fields.state.value = task?.state ?? defaults.state ?? "todo";
  fields.startAt.value = toLocalInput(task?.startAt ?? defaults.startAt);
  fields.dueAt.value = toLocalInput(task?.dueAt ?? defaults.dueAt);
  fields.parentId.replaceChildren(new Option("None · top level", ""));
  const excluded = descendants(tasks, task?.id);
  for (const candidate of tasks) if (!excluded.has(candidate.id)) {
    fields.parentId.add(new Option(candidate.title + " · " + candidate.id, candidate.id));
  }
  if (task?.parentId && !tasks.some(item => item.id === task.parentId)) {
    fields.parentId.add(new Option(task.parentId, task.parentId));
  }
  fields.parentId.value = task?.parentId ?? defaults.parentId ?? "";
  const selected = new Set(task?.dependsOn ?? []), dependencies = $("#dependencies");
  dependencies.replaceChildren();
  const candidates = tasks.filter(candidate => candidate.id !== task?.id);
  for (const id of selected) if (!candidates.some(item => item.id === id)) candidates.push({ id, title: id });
  for (const candidate of candidates) {
    const label = el("label", "dependency-option"), input = el("input"), text = el("span");
    input.type = "checkbox"; input.name = "dependsOn"; input.value = candidate.id;
    input.checked = selected.has(candidate.id);
    text.append(el("span", "dependency-title", candidate.title), el("small", "task-id", candidate.id));
    label.append(input, text); dependencies.append(label);
  }
  if (!candidates.length) dependencies.append(el("p", "dependency-empty", "No other tasks yet; add dependencies later."));
  $("#editor-meta").textContent = task
    ? `${task.id} · created ${formatTime(task.createdAt)} · updated ${formatTime(task.updatedAt)}`
    : "A task can gain a parent and dependencies once it exists.";
}
export function readEditor(editing) {
  const fields = $("#task-form").elements;
  const body = {
    title: fields.title.value.trim(), body: fields.body.value, state: fields.state.value,
    dependsOn: [...document.querySelectorAll('input[name="dependsOn"]:checked')].map(input => input.value),
  };
  if (!body.title) throw new Error("A task title is required.");
  // PATCH null explicitly detaches a parent; creation omits an unset parent.
  if (editing || fields.parentId.value) body.parentId = fields.parentId.value || null;
  for (const [key, value] of [["startAt", fromLocalInput(fields.startAt.value)], ["dueAt", fromLocalInput(fields.dueAt.value)]]) {
    if (value !== undefined) body[key] = value;
    else if (editing) body[key] = null;
  }
  return body;
}
