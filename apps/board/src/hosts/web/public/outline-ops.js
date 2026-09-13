import { applyOp, readDocument } from "./api.js";
import { notify } from "./dom.js";
import { store } from "./state.js";

const idsOf = (nodes) => {
  const ids = new Set();
  const walk = (list) => { for (const item of list) { ids.add(item.nodeId); walk(item.children); } };
  walk(nodes);
  return ids;
};

/**
 * Send one operation against the version the outline was built from - not the
 * version that happens to be current, because the indices below were resolved
 * against the tree as it was then. A refusal means someone else moved the
 * document first, so the editor drops its own view and shows what the document
 * actually says instead of retrying blind.
 */
async function apply(op, version) {
  const current = store.document;
  if (!current) return null;
  try {
    store.document = await applyOp(current.docId, version, op);
  } catch (error) {
    notify(error.message);
    try { store.document = await readDocument(current.docId); } catch { store.document = null; }
  }
  return store.document;
}

/**
 * The outline's actions. Every index is resolved against the tree as rendered:
 * a move is a remove followed by an insert, so a target index is read in the
 * list the node has already left.
 */
export function opsFor(nodes, version, redraw) {
  const parentOf = new Map(), siblingsOf = new Map();
  const walk = (list, parentId) => {
    for (const item of list) { parentOf.set(item.nodeId, parentId); siblingsOf.set(item.nodeId, list); walk(item.children, item.nodeId); }
  };
  walk(nodes, null);
  const indexOf = (item) => (siblingsOf.get(item.nodeId) ?? []).findIndex((entry) => entry.nodeId === item.nodeId);
  const place = (item, parentId, index) => apply({ kind: "move", nodeId: item.nodeId, parentId, index }, version).then(redraw);
  const edit = (op) => apply(op, version).then(redraw);
  const insert = async (parentId, index) => {
    const before = idsOf(store.document?.nodes ?? []);
    const next = await apply({ kind: "insert", parentId, index, text: "" }, version);
    // the caret belongs in the row that just appeared
    store.docFocus = next === null ? undefined : [...idsOf(next.nodes)].find((id) => !before.has(id));
    redraw();
  };
  return {
    add: (item) => insert(item.nodeId, item.children.length),
    addSibling: (item) => insert(parentOf.get(item.nodeId) ?? null, indexOf(item) + 1),
    update: (item, text) => edit({ kind: "update", nodeId: item.nodeId, text }),
    toggle: (item, done) => edit({ kind: "toggle", nodeId: item.nodeId, done }),
    remove: (item) => edit({ kind: "remove", nodeId: item.nodeId }),
    indent: (item) => {
      const siblings = siblingsOf.get(item.nodeId) ?? [], index = indexOf(item);
      if (index > 0) return place(item, siblings[index - 1].nodeId, siblings[index - 1].children.length);
    },
    outdent: (item) => {
      const parentId = parentOf.get(item.nodeId);
      if (parentId == null) return;
      const list = siblingsOf.get(parentId) ?? [];
      return place(item, parentOf.get(parentId) ?? null, list.findIndex((entry) => entry.nodeId === parentId) + 1);
    },
    up: (item) => {
      const index = indexOf(item);
      if (index > 0) return place(item, parentOf.get(item.nodeId) ?? null, index - 1);
    },
    down: (item) => {
      const siblings = siblingsOf.get(item.nodeId) ?? [], index = indexOf(item);
      if (index >= 0 && index < siblings.length - 1) return place(item, parentOf.get(item.nodeId) ?? null, index + 1);
    },
  };
}
