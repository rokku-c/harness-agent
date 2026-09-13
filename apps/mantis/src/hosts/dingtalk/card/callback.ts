/**
 * card/callback.ts - PARSING the TOPIC_CARD callback into a verdict.
 *
 * Concept: a card click comes back over dingtalk-stream as a nested,
 * schema-unstable payload, and this reads the one thing the host needs from it -
 * which call, and what the operator said. The tree walking belongs to walk.ts.
 *
 * The verdict is read from a field NAMED `action`, never from a token met
 * anywhere else: the card carries the tool's own arguments out to the operator
 * (`approvalCardParamMap` puts `input` in the card data), so a call whose
 * argument happens to contain the word "approve" would otherwise resolve its own
 * approval. A payload naming both verdicts resolves to nothing rather than to
 * the permissive one, because only the operator's click may decide.
 */
import { actionsOf, findString, unwrapJson } from "./walk.ts"
import { callIdFromOutTrackId, type CardAction } from "./types.ts"

/** the button tokens, in the template's own vocabulary */
const VERDICTS: Readonly<Record<string, "approve" | "deny">> = {
  approve: "approve",
  "同意": "approve",
  deny: "deny",
  "拒绝": "deny"
}

/** the verdict the clicked button names; ambiguous or absent resolves to nothing */
const findAction = (node: unknown): CardAction["action"] | undefined => {
  const verdicts = actionsOf(unwrapJson(node))
    .map((raw) => VERDICTS[raw.trim().toLowerCase()])
    .filter((verdict): verdict is "approve" | "deny" => verdict !== undefined)
  const distinct = [...new Set(verdicts)]
  return distinct.length === 1 ? distinct[0] : undefined
}

/** parse a TOPIC_CARD callback payload into an approval verdict */
export const parseCardAction = (data: unknown): CardAction | undefined => {
  const root = typeof data === "string" ? unwrapJson(data) : data
  if (typeof root !== "object" || root === null) return undefined
  const record = root as Record<string, unknown>
  const action = findAction(record)
  if (action === undefined) return undefined
  const outTrackId = findString(record, "outTrackId")
  if (outTrackId === undefined) return undefined
  const callId = callIdFromOutTrackId(outTrackId)
  if (callId === "") return undefined
  return { callId, action }
}
