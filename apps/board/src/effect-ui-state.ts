import type { UiSourceSpec } from "@effect-agent/effect-ui"
import { worktableUrl } from "./effect-ui-worktable.ts"

export const boardState: Readonly<Record<string, unknown>> = {
  table: { columns: [], rows: [] },
  filter: "all",
  query: "",
  view: "table",
  create: { title: "", body: "", state: "todo" },
  createResult: {},
  selected: {},
  selectedResult: {},
  documents: { documents: [] },
  docDraft: { title: "" },
  docResult: {},
  outline: {
    read: { nodes: [] },
    rename: { kind: "retitle", title: "" },
    insert: { kind: "insert", parentId: null, index: 0, text: "" },
  },
  outlineResult: {},
  events: { events: [] },
}

export const boardSources: readonly UiSourceSpec[] = [
  { id: "table", url: worktableUrl, state: "/table", refreshMs: 10000 },
  { id: "documents", url: "/board/api/documents", state: "/documents", refreshMs: 10000 },
  { id: "events", url: "/board/api/events?tail=50", state: "/events", refreshMs: 10000 },
]
