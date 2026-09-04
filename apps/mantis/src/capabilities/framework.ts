/**
 * capabilities/framework.ts - the FIXED SESSION SURFACE.
 *
 * Concept: the framework entries every session starts with - catalog,
 * enable, workspace reads and the ui_render op (the A2UI v0.9 renderer with
 * its interaction contract for operator forms).
 */
import type { CapabilityDecl } from "./types.ts"

export const FRAMEWORK: readonly CapabilityDecl[] = [
  {
    name: "tools_catalog",
    tier: "core",
    impl: "catalog",
    description: "List every tool currently available and every extended tool you may enable."
  },
  {
    name: "enable",
    tier: "core",
    impl: "enable",
    description: "Activate an extended tool so it joins your visible tool surface this session."
  },
  {
    name: "recall_notes",
    tier: "core",
    impl: "notes.search",
    description: "Search the workspace notes, reminders and tasks by text, optionally filtered by kind or by who wrote the record (source: 'agent' or 'ui' for operator-written)."
  },
  {
    name: "note_read",
    tier: "extended",
    impl: "notes.read",
    description: "Read the full workspace: every note, reminder and task in the shared durable store (they persist across sessions and are shared by humans and agents)."
  },
  {
    name: "update_record",
    tier: "extended",
    impl: "resource.update",
    description: "Change the text of ONE existing workspace record by id. Record ids come from recall_notes / note_read outputs; the kind is implied by the record itself."
  },
  {
    name: "delete_record",
    tier: "extended",
    impl: "resource.delete",
    description: "Delete ONE existing workspace record by id (removed from recall and reads). Record ids come from recall_notes / note_read outputs. Deleting a record that no longer exists is an error - do not retry."
  },
  {
    name: "ui_render",
    tier: "extended",
    impl: "ui.render",
    description:
      "Render UI on the operator console using the OFFICIAL A2UI v0.9 protocol (a2ui.org). " +
      "input.spec is JSONL or a JSON array of A2UI messages: a createSurface message first, then " +
      "updateComponents with components from the Basic Catalog (Text/Row/Column/List/Button/TextField/Card/Image/...). " +
      'Example: {"version":"v0.9","createSurface":{"surfaceId":"main","catalogId":"https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"}} ' +
      'then {"version":"v0.9","updateComponents":{"surfaceId":"main","components":[' +
      '{"id":"t","component":"Text","text":"hello","variant":"h1"},' +
      '{"id":"b","component":"Button","child":"bl","action":{"event":{"name":"go"}}},' +
      '{"id":"bl","component":"Text","text":"Go"}]}}. ' +
      'Interactive forms: bind each input to a data path (TextField value {"path":"/form/task"}) and declare ' +
      "that SAME path in the submit button action.event.context key so the typed value returns to you as " +
      '[ui.action] name {"k":"v"}. ' +
      "Catalog gotchas: components accept ONLY official basic catalog props; TextField needs label, " +
      "variant one of shortText|longText|number|obscured; Button fires action.event.name (never action.name); " +
      "Image takes url (not src); Card/List/Row/Column child/children reference OTHER component ids - never inline data; " +
      "button text is its own Text node referenced by Button.child; Text variant: h1..h5|caption|body. " +
      "Every render is versioned. " +
      "IMPORTANT: values arriving as [ui.action] NAME {...} come from the operator " +
      "clicking a form button - they already decided to act, so proceed with the " +
      "matching workspace write right away (a protected write pauses for operator " +
      "approval automatically; never refuse or just 'wait for instructions')."
  }
]
