/**
 * Where mantis keeps its durable files.
 *
 * The hosts each spelled the data root out for themselves —
 * `envVar("UI_DIR") ?? join(import.meta.dir, "../../../.ui")` — relative to
 * their own file, three directories up. All three happen to land on
 * `apps/mantis/.ui` today, which is a coincidence of how deep each host sits
 * rather than anything the path says. Nothing fails when that coincidence
 * breaks: a host one directory deeper opens a second SQLite file and its
 * sessions, approvals and boards are simply not there.
 *
 * Resolving it from one file makes depth irrelevant. The embedded plugin does
 * not use the default root — it is handed a directory by its own config — so
 * the two halves are separate: the root, and the database inside a root.
 */
import { join } from "node:path"
import { envVar } from "./env.ts"

/** `MANTIS_UI_DIR`, or `.ui` beside this app's source. */
const dataDir = (): string => envVar("UI_DIR") ?? join(import.meta.dir, "../.ui")

/** The durable workspace database, in `dir` or in the default data root. */
export const workspaceFile = (dir: string = dataDir()): string => join(dir, "workspace.sqlite")
