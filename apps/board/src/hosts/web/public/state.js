export const states = [
  { id: "todo", label: "待开始" }, { id: "doing", label: "进行中" },
  { id: "blocked", label: "受阻" }, { id: "done", label: "已完成" },
  { id: "cancelled", label: "已取消" },
];
export const viewNames = { board: "看板视图", tree: "层级视图", table: "列表视图" };
export const store = { tasks: [], counts: {}, view: "board", query: "", state: "", loaded: false, collapsed: new Set() };
export const stateLabel = id => states.find(state => state.id === id)?.label ?? id;
export const taskMap = tasks => new Map(tasks.map(task => [task.id, task]));
export function visibleTasks() {
  const query = store.query.trim().toLocaleLowerCase();
  return store.tasks.filter(task => (!store.state || task.state === store.state) &&
    (!query || [task.title, task.body, task.id].join(" ").toLocaleLowerCase().includes(query)))
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
export function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}
