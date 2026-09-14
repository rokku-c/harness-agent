import { cellOf, chip, listCard, press, stateBadge, type UiNodeSpec } from "@effect-agent/effect-ui"
import { chipWhen } from "./effect-ui-cells.ts"
import { IDENTITIES, TOKENS } from "./effect-ui-paths.ts"

const revoke: UiNodeSpec = {
  ...press("Revoke", "gateway.revokeToken", { tokenHash: { item: "tokenHash" } }, { size: "1", variant: "soft", color: "red" }),
  visible: { source: { item: "status" }, equals: "active" },
}

export const tokensTable = listCard({
  title: "Tokens",
  id: IDENTITIES,
  empty: "No token has been issued. The form below issues one and answers it once.",
  headings: ["Token", "Principal", "State", "Issued", "Expires", "Last used", ""],
  cells: [
    cellOf(chip("fingerprint")),
    cellOf(chip("principalKey")),
    cellOf(stateBadge("status")),
    cellOf(chip("issued")),
    cellOf(chipWhen("expires")),
    cellOf(chipWhen("lastUsed")),
    cellOf(revoke),
  ],
  repeat: { source: { state: TOKENS } },
})
