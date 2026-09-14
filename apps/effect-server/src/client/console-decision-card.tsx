/**
 * One decision, open: what a human needs to judge it.
 *
 * `flows.md` §2.H10 asks this pane for two controls, `Allow` and `Deny`, plus
 * `Hold`. They are not drawn, and the reason is not a design choice: a verdict is
 * a write to the decision store (§9.1), that store does not exist yet, and a pair
 * of buttons that cannot write would report a decision answered while the agent
 * stayed blocked — the exact failure this object exists to end. What is drawn is
 * everything §1.5 makes readable, including the answer when it was given
 * elsewhere (§2.H10.5), so the pane is complete as a record and honest about
 * being one.
 */

import * as React from "react"
import { Flex, Heading, Text } from "@radix-ui/themes"
import type { Decision } from "./console-decision.ts"
import { readAt } from "./console-source.ts"

const Row = ({ label, value }: { readonly label: string; readonly value: string }) =>
  <Flex gap="3" align="start">
    <Text size="1" color="gray" style={{ minWidth: 104 }}>{label}</Text>
    <Text size="2">{value}</Text>
  </Flex>

/** Both halves of a deadline: the instant, and how long is left of it when this is drawn. */
const deadlineText = (deadline: number): string => {
  const left = Math.round((deadline - Date.now()) / 60_000)
  if (left <= 0) return `${readAt(deadline)} · expired`
  return `${readAt(deadline)} · in ${left} min`
}

const stateText = (decision: Decision): string => {
  if (decision.state === "waiting") return "waiting for a verdict"
  if (decision.state === "already-answered-elsewhere" || decision.answeredBy !== undefined) {
    return `answered by ${decision.answeredBy ?? "another surface"}${decision.answeredAt === undefined ? "" : ` at ${readAt(decision.answeredAt)}`}${decision.answerSource === undefined ? "" : `, from the ${decision.answerSource}`}`
  }
  return decision.state
}

export const DecisionCard = ({ decision }: { readonly decision: Decision }) =>
  <Flex direction="column" gap="3">
    <Flex direction="column" gap="1">
      <Heading size="3">{decision.subject}</Heading>
      <Text size="2" color="gray">{stateText(decision)}</Text>
    </Flex>
    <Row label="Class" value={decision.class} />
    <Row label="Asked by" value={decision.raisedBy} />
    <Row label="Blocking" value={decision.raisedFor} />
    <Row label="Reasons" value={decision.reasons.join(" · ")} />
    <Row label="Deadline" value={deadlineText(decision.deadline)} />
    {decision.recovery === undefined ? null : <Row label="Recovery" value={decision.recovery} />}
  </Flex>
