import { createDocument, deleteDocument, readDocument } from "./api.js";
import { button, el, notify } from "./dom.js";
import { store } from "./state.js";

/** The outline rail: start one, open one, drop one. */
export function docList(redraw) {
  const rail = el("aside", "doc-rail");
  const head = el("div", "doc-rail-head");
  head.append(el("span", "doc-rail-title", "Outlines"));
  head.append(button("＋ New", "button secondary", async () => {
    try {
      const doc = await createDocument({ title: "Untitled outline", nodes: [] });
      store.documents.unshift({ docId: doc.docId, title: doc.title, version: doc.version, updatedAt: doc.updatedAt });
      store.document = doc; store.docFocus = undefined;
      redraw();
    } catch (error) { notify(error.message); }
  }));
  rail.append(head);
  if (!store.documents.length) rail.append(el("p", "doc-empty", "No outlines yet."));
  for (const summary of store.documents) {
    const row = el("div", "doc-rail-row");
    const open = button(summary.title, "doc-rail-open", async () => {
      try { store.document = await readDocument(summary.docId); store.docFocus = undefined; redraw(); }
      catch (error) { notify(error.message); }
    });
    open.title = `Version ${summary.version}`;
    if (store.document?.docId === summary.docId) open.setAttribute("aria-current", "true");
    const drop = button("×", "doc-rail-drop", async () => {
      try {
        await deleteDocument(summary.docId);
        store.documents = store.documents.filter((entry) => entry.docId !== summary.docId);
        if (store.document?.docId === summary.docId) store.document = null;
        redraw();
      } catch (error) { notify(error.message); }
    });
    drop.title = "Delete this outline"; drop.setAttribute("aria-label", `Delete ${summary.title}`);
    row.append(open, drop);
    rail.append(row);
  }
  return rail;
}
