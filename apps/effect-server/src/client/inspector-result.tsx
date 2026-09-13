/**
 * What the tool answered.
 *
 * A refusal is not a result: `invoke` validates against the tool's own schema,
 * so a rejection here is the tool's message about the arguments, and it renders
 * as one. A success is the tool's own output — JSON when it has a shape, the
 * text itself when it is a string — in the design system's code face.
 */

import * as React from "react"
import { Callout, Card, Flex, Heading, Text } from "@radix-ui/themes"
import type { CallResult } from "./inspector-call.ts"

const shown = (value: unknown): string => {
  if (typeof value === "string") return value
  if (value === undefined) return "No result."
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}

export const InspectorResult = ({ result }: { readonly result: CallResult | undefined }) => {
  if (result === undefined) return null
  if (!result.ok) {
    return <Callout.Root color="red"><Callout.Text>{result.error ?? "The call failed."}</Callout.Text></Callout.Root>
  }
  return <Flex direction="column" gap="2">
    <Heading size="3">Result</Heading>
    <Card>
      <Text as="div" size="1" style={{ fontFamily: "var(--code-font-family)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {shown(result.result)}
      </Text>
    </Card>
  </Flex>
}
