export const states = [
  { id: "todo", label: "To do" }, { id: "doing", label: "Doing" },
  { id: "blocked", label: "Blocked" }, { id: "done", label: "Done" },
  { id: "cancelled", label: "Cancelled" },
];
export const viewNames = { board: "Board", tree: "Tree", table: "Table", calendar: "Calendar", documents: "Documents" };
export const store = {
  tasks: [], counts: {}, agents: [], runs: new Map(), view: "board", query: "", state: "",
  loaded: false, collapsed: new Set(), month: new Date(),
  documents: [], document: null, docLoaded: false, docFocus: undefined,
};
/** A parent's own state is what an operator set; what its children make of it is the rollup. */
export const displayState = task => task.rollup?.state ?? task.state;
export const stateLabel = id => states.find(state => state.id === id)?.label ?? id;
export const taskMap = tasks => new Map(tasks.map(task => [task.id, task]));
export function visibleTasks() {
  const query = store.query.trim().toLocaleLowerCase();
  return store.tasks.filter(task => (!store.state || displayState(task) === store.state) && (!query ||
    [task.title, task.body, task.id, store.runs.get(task.id)?.agentId ?? ""].join(" ").toLocaleLowerCase().includes(query)))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}
export function descendants(tasks, id) {
  const result = new Set(id ? [id] : []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of tasks) if (result.has(task.parentId) && !result.has(task.id)) {
      result.add(task.id); changed = true;
    }
  }
  return result;
}
