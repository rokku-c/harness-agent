/**
 * The tokens issued to the identities above: what is out there, and what to do
 * about it.
 *
 * A row leads with the fingerprint, because that is the only name a token has
 * once it has been handed over — the plaintext is the holder's and is nowhere
 * here — and the principal beside it says whose credential it is. Its second
 * line is when it was issued, when it was last used and when it lapses, which
 * are the three facts a decision to revoke is made on: a credential nobody has
 * used in months is one to cut, and one that lapses tomorrow may be left alone.
 *
 * "Never used" is written rather than left blank. A blank reads as a fact that
 * failed to load, and a token that has never been presented is a real and
 * interesting state — it is a credential that was handed to nobody, or one that
 * was handed over and never worked.
 *
 * Revoke is offered only while it would do something. A revoked token is final
 * — the store refuses a second revocation rather than restamping it — so the row
 * stops offering the press the moment it has been made, and the badge that took
 * its place is the answer to it.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { chip, emptyRows, failureBadge, identitiesSource, list, press, recordRow, revokeResult, section, stack, stateBadge, stateRows, tokensPath, whenRows } from "./effect-ui-nodes.ts"

/** One fact of a credential's life, with the word that introduces it. Both hide together. */
const fact = (item: string, lead: string): readonly UiNodeSpec[] => [
  { component: "Text", props: { value: lead, size: "1", color: "gray" }, visible: { source: { item } } },
  { component: "Text", props: { size: "1", color: "gray" }, item, visible: { source: { item } } },
]

/** The three dates, in the order they happen, said as a sentence rather than as three columns. */
const activity: UiNodeSpec = {
  component: "Flex",
  props: { gap: "1", wrap: "wrap", align: "center" },
  children: [
    ...fact("issued", "issued"),
    ...fact("lastUsed", "· last used"),
    { component: "Text", props: { value: "· never used", size: "1", color: "gray" },
      visible: { source: { item: "lastUsed" }, not: true } },
    ...fact("expires", "· expires"),
  ],
}

/** The press names the record by the hash the listing reports, which is the only name it has. */
const revoke: UiNodeSpec = {
  ...press("Revoke", "gateway.revokeToken", { tokenHash: { item: "tokenHash" } }, { size: "1", color: "red" }),
  visible: { source: { item: "status" }, equals: "active" },
}

const row: UiNodeSpec = stack([
  recordRow([chip("fingerprint"), chip("principalKey"), stateBadge("status")], revoke),
  activity,
])

export const tokensSection: UiNodeSpec = section("Issued tokens", [
  failureBadge(`${revokeResult}/error`),
  emptyRows(identitiesSource, tokensPath, "No token has been issued yet."),
  whenRows(stateRows(tokensPath), list({ source: { state: tokensPath }, key: "tokenHash" }, row)),
])
