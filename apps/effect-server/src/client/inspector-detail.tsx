/**
 * One tool, opened: what it is, what it takes, and what it answered.
 *
 * The form is built from the tool's own schema every time the tool changes, so
 * switching tools cannot leave the previous tool's arguments in the fields. The
 * call goes to the app's own interface — the same registry MCP serves — so what
 * an operator sees here is what an agent gets, and an argument the tool refuses
 * says why in the callout below.
 */

import * as React from "react"
import { Button, Code, Flex, Heading, Separator, Text } from "@radix-ui/themes"
import { InspectorField } from "./inspector-field.tsx"
import { InspectorResult } from "./inspector-result.tsx"
import { argsOf, callTool, type CallResult } from "./inspector-call.ts"
import { fieldsOf, initialValues } from "./inspector-schema.ts"
import type { InspectorTool } from "./inspector-types.ts"

const message = (error: unknown): string => error instanceof Error ? error.message : String(error)

export const InspectorDetail = ({ id, tool }: { readonly id: string; readonly tool: InspectorTool }) => {
  const fields = React.useMemo(() => fieldsOf(tool.inputSchema), [tool.inputSchema])
  const [values, setValues] = React.useState(() => initialValues(fields))
  const [result, setResult] = React.useState<CallResult | undefined>(undefined)
  const [running, setRunning] = React.useState(false)

  const run = (): void => {
    let args: unknown
    try {
      args = argsOf(fields, values)
    } catch (error) {
      setResult({ ok: false, error: message(error) })
      return
    }
    setRunning(true)
    void callTool(id, tool.name, args)
      .then(setResult, (error: Error) => setResult({ ok: false, error: error.message }))
      .finally(() => setRunning(false))
  }

  return <Flex direction="column" gap="4">
    <Flex direction="column" gap="1">
      <Heading size="4">{tool.title ?? tool.name}</Heading>
      <Text size="2" color="gray"><Code>{tool.name}</Code>{tool.description === undefined ? "" : ` — ${tool.description}`}</Text>
    </Flex>
    <Separator size="4" />
    <Heading size="3">Arguments</Heading>
    {fields.length === 0
      ? <Text size="2" color="gray">This tool takes no arguments.</Text>
      : <Flex direction="column" gap="4">
          {fields.map((field) => <InspectorField key={field.name} field={field} value={values[field.name] ?? ""}
            onChange={(next) => setValues((old) => ({ ...old, [field.name]: next }))} />)}
        </Flex>}
    <Flex>
      <Button loading={running} onClick={run}>{running ? "Running" : "Run"}</Button>
    </Flex>
    <InspectorResult result={result} />
  </Flex>
}
