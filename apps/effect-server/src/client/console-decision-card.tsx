import * as React from "react"
import { Flex, Heading, Text } from "@radix-ui/themes"
import type { Decision } from "./console-decision.ts"
import { readAt } from "./console-source.ts"

const Row = ({ label, value }: { readonly label: string; readonly value: string }) =>
  <Flex gap="3" align="start">
    <Text size="1" color="gray" style={{ minWidth: 104 }}>{label}</Text>
    <Text size="2">{value}</Text>
  </Flex>

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
