import { applyOp, readDocument, readDocuments } from "./api.js";
import { el, notify } from "./dom.js";
import { store } from "./state.js";
import { docList } from "./doc-list.js";
import { outlineRows } from "./outline-node.js";
import { opsFor } from "./outline-ops.js";

export async function loadDocuments() {
  store.documents = (await readDocuments()).documents;
  store.docLoaded = true;
  if (store.document && !store.documents.some((entry) => entry.docId === store.document.docId)) store.document = null;
}

const retitle = async (title, redraw) => {
  const current = store.document;
  if (!current) return;
  try { store.document = await applyOp(current.docId, current.version, { kind: "retitle", title }); }
  catch (error) { notify(error.message); }
  redraw();
};

/** The open outline. Its version is on screen, so a stale editor is visible. */
function pane(redraw) {
  const box = el("section", "doc-pane"), doc = store.document;
  if (doc === null) {
    const empty = el("div", "empty-state");
    empty.append(el("span", "empty-symbol", "☰"), el("h3", "", "No outline open"),
      el("p", "", "Pick one on the left, or start a new outline."));
    box.append(empty);
    return box;
  }
  const title = el("input", "doc-title");
  title.value = doc.title; title.setAttribute("aria-label", "Outline title");
  title.addEventListener("change", () => { if (title.value.trim() && title.value !== doc.title) void retitle(title.value.trim(), redraw); });
  const head = el("header", "doc-pane-head");
  head.append(title, el("span", "doc-version", `v${doc.version}`));
  const outline = el("div", "outline"), ops = opsFor(doc.nodes, doc.version, redraw);
  if (doc.nodes.length) outline.append(...doc.nodes.flatMap((item) => outlineRows(item, 0, ops)));
  else outline.append(el("p", "doc-empty", "Empty outline. Add the first item below."));
  box.append(head, outline);
  const focus = store.docFocus;
  store.docFocus = undefined;
  // a redraw replaces every row, so an edit would otherwise drop the caret
  if (focus !== undefined) box.querySelector(`[data-node-id="${focus}"] .outline-text`)?.focus();
  return box;
}

export function docView(redraw) {
  const layout = el("div", "doc-layout");
  layout.append(docList(redraw), pane(redraw));
  return layout;
}
