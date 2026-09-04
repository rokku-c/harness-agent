/**
 * capabilities/framework.ts - the FIXED SESSION SURFACE.
 *
 * Concept: the framework entries every session starts with - catalog,
 * enable, and workspace reads.
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
]
