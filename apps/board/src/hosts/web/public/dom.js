import { stateLabel } from "./state.js";
export const $ = selector => document.querySelector(selector);
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function button(text, className, action) {
  const node = el("button", className, text);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}
export function badge(state) {
  const node = el("span", "state-badge", stateLabel(state));
  node.dataset.state = state;
  return node;
}
export function emptyState(title, detail, action) {
  const node = el("div", "empty-state");
  node.append(el("span", "empty-symbol", "▥"), el("h3", "", title), el("p", "", detail));
  if (action) node.append(button("新建任务", "button primary", action));
  return node;
}
let noticeTimer;
export function notify(message) {
  clearTimeout(noticeTimer);
  const node = $("#notice");
  node.textContent = message; node.hidden = false;
  noticeTimer = setTimeout(() => { node.hidden = true; }, 3500);
}
export function showError(node, error) {
  node.textContent = error ? error.message || String(error) : "";
  node.hidden = !error;
}
