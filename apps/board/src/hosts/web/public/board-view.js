import { displayState, states, taskMap } from "./state.js";
import { el, button } from "./dom.js";
import { taskCard } from "./cards.js";
export function boardView(tasks, allTasks, onEdit, onCreate) {
  const board = el("div", "board-grid"), lookup = taskMap(allTasks);
  for (const state of states) {
    const column = el("section", "board-column");
    column.dataset.state = state.id;
    column.setAttribute("aria-label", state.label);
    const items = tasks.filter(task => displayState(task) === state.id);
    const heading = el("div", "column-heading"), title = el("div", "column-title");
    title.append(el("span", "column-dot"), el("h3", "", state.label), el("span", "column-count", items.length));
    const add = button("＋", "column-add", () => onCreate({ state: state.id }));
    add.setAttribute("aria-label", `New ${state.label} task`);
    heading.append(title, add); column.append(heading);
    const list = el("div", "card-list");
    for (const task of items) list.append(taskCard(task, lookup, onEdit));
    if (!items.length) list.append(el("div", "column-empty", "No tasks"));
    column.append(list); board.append(column);
  }
  return board;
}
