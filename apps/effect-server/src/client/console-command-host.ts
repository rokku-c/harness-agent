/**
 * §6.4's two groups that come from a read: every registered operation, and the
 * decisions that are waiting.
 *
 * Both navigate and neither runs anything, so both are pure destinations — which
 * is why they can be drawn from a list the palette fetched on a keystroke without
 * the console having to be on the screen the list belongs to. The address is the
 * destination in each case (`#tools/<app>/<operation>`, `#inbox/<id>`), which is
 * what makes an operation searchable by its name: the name is in the address, and
 * the address is part of what a row is matched against.
 *
 * An operation's label is its title when it has one and its name when it does
 * not, because a name like `board.open` is what the MCP door calls it and a title
 * is what the app chose to be read as. Both are matched either way.
 */

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

/**
 * Only the waiting ones. A decision that has been answered, expired or withdrawn
 * is a record and not a queue, and §6.4 asks this group for "waiting decisions":
 * a row that offered to take a reader to a verdict they have already given would
 * be the one row in the palette that wastes a press.
 */
export const decisionRows = ({ decisions }: PaletteInput): readonly CommandRow[] =>
  decisions.filter((decision) => decision.state === "waiting").map((decision) => ({
    id: `decision/${decision.id}`,
    label: decision.subject,
    caption: `Decision · ${decision.raisedBy}`,
    glyph: "Tray",
    address: hashOf({ kind: "inbox", decisionId: decision.id }),
    action: { kind: "go", route: { kind: "inbox", decisionId: decision.id } },
  }))
