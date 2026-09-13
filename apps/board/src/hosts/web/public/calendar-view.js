import { el, button } from "./dom.js";
import { dayKey, formatClock, formatMonth, monthGrid } from "./dates.js";
/** A task lands on the day it starts, or on its due day when that is all it has. */
const dayOf = task => task.startAt ?? task.dueAt;
const HOUR = 3_600_000;
export function calendarView(tasks, month, onEdit, onCreate, navigate) {
  const buckets = new Map();
  for (const task of tasks) {
    if (dayOf(task) === undefined) continue;
    const key = dayKey(new Date(dayOf(task)));
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(task);
  }
  const wrapper = el("div", "calendar");
  const heading = el("div", "calendar-heading");
  const steps = el("div", "calendar-nav");
  steps.append(
    button("‹", "calendar-step", () => navigate(-1)),
    button("Today", "button secondary", () => navigate(0)),
    button("›", "calendar-step", () => navigate(1)),
  );
  steps.firstChild.setAttribute("aria-label", "Previous month");
  steps.lastChild.setAttribute("aria-label", "Next month");
  heading.append(el("h3", "", formatMonth(month)), steps);
  const weekdays = el("div", "calendar-weekdays");
  for (const label of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
    weekdays.append(el("span", "", label));
  }
  const grid = el("div", "calendar-grid"), today = dayKey(new Date());
  for (const day of monthGrid(month)) {
    const key = dayKey(day), cell = el("div", "calendar-day");
    cell.dataset.today = String(key === today);
    cell.dataset.outside = String(day.getMonth() !== month.getMonth());
    const head = el("div", "calendar-day-head"), add = button("＋", "calendar-add", () =>
      onCreate({ startAt: day.getTime() + 9 * HOUR }));
    add.setAttribute("aria-label", `New task on ${key}`);
    head.append(el("span", "calendar-day-number", String(day.getDate())), add);
    cell.append(head);
    for (const task of buckets.get(key) ?? []) cell.append(chip(task, onEdit));
    grid.append(cell);
  }
  wrapper.append(heading, weekdays, grid, footer(tasks));
  return wrapper;
}
function chip(task, onEdit) {
  const node = button("", "calendar-task", () => onEdit(task));
  node.dataset.state = task.state;
  const dot = el("span", "calendar-dot");
  dot.dataset.state = task.state;
  node.append(dot, el("span", "calendar-task-title", task.title),
    el("span", "calendar-time", task.startAt !== undefined ? formatClock(task.startAt) : "due"));
  node.title = task.title;
  return node;
}
/** Says out loud what the calendar is not showing, rather than dropping it. */
function footer(tasks) {
  const unscheduled = tasks.filter(task => dayOf(task) === undefined).length;
  const note = el("p", "calendar-note");
  note.append(el("span", "", unscheduled
    ? `${unscheduled} task${unscheduled === 1 ? "" : "s"} without a start or due time are not on the calendar. `
    : "Every task on this board has a time. "),
  el("span", "", "Subscribe: "), el("code", "", new URL("api/calendar.ics", document.baseURI).href));
  return note;
}
