/**
 * Every credential the door can be knocked with, newest first.
 *
 * A token is named by the first eight characters of its hash, because that is
 * all the record has left once the plaintext has been handed over: the listing
 * cannot say what the token was, only that it exists, who holds it, and whether
 * it still works. The full hash stays in the row the press carries, since that
 * is what a revocation addresses — an operator revoking a credential should not
 * have to read sixty-four characters to do it.
 *
 * `Revoke` is offered only on a live token. Revoking one that is already revoked
 * is a call the door refuses with a 404, and offering a press whose only
 * possible answer is a refusal is how an operator learns to distrust the screen.
 *
 * The state is the record's own word — active, expired, revoked — and it is a
 * `stateBadge`, which carries no colour: a token's state is an enumeration
 * rather than a verdict, and the tones on this screen are spent on the access
 * decision and on a read that failed (§3.5).
 */
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
