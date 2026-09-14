import { hashOf } from "./console-nav.ts"
import type { CommandRow, PaletteInput } from "./console-commands.ts"

export const operationRows = ({ operations }: PaletteInput): readonly CommandRow[] =>
  operations.flatMap((app) => app.tools.map((tool) => ({
    id: `operation/${app.id}/${tool.name}`,
    label: tool.title ?? tool.name,
    caption: `Operation · ${app.title}`,
    glyph: "Wrench",
    address: hashOf({ kind: "tools", app: app.id, operation: tool.name }),
    owner: app.id,
    action: { kind: "go", route: { kind: "tools", app: app.id, operation: tool.name } },
  })))

export const decisionRows = ({ decisions }: PaletteInput): readonly CommandRow[] =>
  decisions.filter((decision) => decision.state === "waiting").map((decision) => ({
    id: `decision/${decision.id}`,
    label: decision.subject,
    caption: `Decision · ${decision.raisedBy}`,
    glyph: "Tray",
    address: hashOf({ kind: "inbox", decisionId: decision.id }),
    action: { kind: "go", route: { kind: "inbox", decisionId: decision.id } },
  }))
