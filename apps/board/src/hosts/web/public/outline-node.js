import { button, el } from "./dom.js";

/**
 * One outline row and, flat, every row below it. Indentation is a `--depth`
 * variable rather than nesting, so the DOM stays one list of rows and a redraw
 * never rebuilds a subtree wrapper.
 */
export function outlineRows(item, depth, ops) {
  const row = el("div", "outline-row");
  row.dataset.nodeId = item.nodeId;
  row.dataset.done = String(item.done);
  row.style.setProperty("--depth", depth);
  const check = el("input", "outline-check");
  check.type = "checkbox"; check.checked = item.done;
  check.setAttribute("aria-label", item.done ? `Reopen: ${item.text}` : `Complete: ${item.text}`);
  check.addEventListener("change", () => ops.toggle(item, check.checked));
  const text = el("input", "outline-text");
  text.value = item.text; text.placeholder = "Outline item";
  text.setAttribute("aria-label", "Item text");
  text.addEventListener("change", () => { if (text.value !== item.text) ops.update(item, text.value); });
  // Enter continues the list, Backspace on an empty row removes it — the two
  // gestures anyone writing an outline already expects
  text.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); ops.addSibling(item); }
    if (event.key === "Backspace" && text.value === "") { event.preventDefault(); ops.remove(item); }
  });
  const actions = el("div", "outline-actions");
  for (const [label, title, action] of [
    ["＋", "Add a sub-item", () => ops.add(item)],
    ["→", "Indent under the item above", () => ops.indent(item)],
    ["←", "Outdent one level", () => ops.outdent(item)],
    ["↑", "Move up", () => ops.up(item)],
    ["↓", "Move down", () => ops.down(item)],
    ["×", "Delete this item and its sub-items", () => ops.remove(item)],
  ]) {
    const control = button(label, "outline-action", action);
    control.title = title; control.setAttribute("aria-label", title);
    actions.append(control);
  }
  row.append(check, text, actions);
  return [row, ...item.children.flatMap((child) => outlineRows(child, depth + 1, ops))];
}
