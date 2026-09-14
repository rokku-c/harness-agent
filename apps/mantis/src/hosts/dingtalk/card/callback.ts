import { actionsOf, findString, unwrapJson } from "./walk.ts"
import { callIdFromOutTrackId, type CardAction } from "./types.ts"

const VERDICTS: Readonly<Record<string, "approve" | "deny">> = {
  approve: "approve",
  "同意": "approve",
  deny: "deny",
  "拒绝": "deny"
}

const findAction = (node: unknown): CardAction["action"] | undefined => {
  const verdicts = actionsOf(unwrapJson(node))
    .map((raw) => VERDICTS[raw.trim().toLowerCase()])
    .filter((verdict): verdict is "approve" | "deny" => verdict !== undefined)
  const distinct = [...new Set(verdicts)]
  return distinct.length === 1 ? distinct[0] : undefined
}

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
