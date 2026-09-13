const pad = value => String(value).padStart(2, "0");
export const dayKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const startOfMonth = date => new Date(date.getFullYear(), date.getMonth(), 1);
export const addMonths = (date, count) => new Date(date.getFullYear(), date.getMonth() + count, 1);
export const formatTime = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-US", {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
};
export const formatClock = value => new Date(value).toLocaleTimeString("en-US", {
  hour: "2-digit", minute: "2-digit", hour12: false,
});
export const formatMonth = date => date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
/** <input type="datetime-local"> speaks local wall time, not an instant. */
export const toLocalInput = value => {
  if (value === undefined || value === null) return "";
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
export const fromLocalInput = text => text ? new Date(text).getTime() : undefined;
/** Six weeks of days covering the month, so the grid never reflows height. */
export const monthGrid = date => {
  const first = startOfMonth(date), start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};
