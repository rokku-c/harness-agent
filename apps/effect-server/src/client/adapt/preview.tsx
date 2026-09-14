import * as React from "react"
import { Callout, Card, Code, Text } from "@radix-ui/themes"
import type { ComponentRenderer } from "@json-render/react"
import { propsOf } from "./contract.ts"

interface PreviewValue {
  readonly kind?: string
  readonly mimeType?: string
  readonly body?: string
  readonly uri?: string
  readonly error?: string
}

const resourceOf = (value: unknown): PreviewValue =>
  typeof value === "object" && value !== null ? value as PreviewValue : {}

export const Preview: ComponentRenderer = (ctx) => {
  const props = propsOf(ctx)
  const value = resourceOf(props.value)
  const height = props.height === undefined ? undefined : String(props.height)
  if (typeof value.error === "string") return <Callout.Root color="red" size="1"><Callout.Text>{value.error}</Callout.Text></Callout.Root>
  if (typeof value.body !== "string") return <Card variant="surface"><Text size="2" color="gray">Select a resource to preview.</Text></Card>
  if (value.kind === "html") return <iframe title={value.uri ?? "Resource preview"} sandbox="allow-scripts" srcDoc={value.body} style={{ width: "100%", border: 0, height: height ?? "420px", background: "white" }} />
  if (value.kind === "image") return <img alt={value.uri ?? "Resource preview"} src={`data:${value.mimeType ?? "image/png"};base64,${value.body}`} style={{ maxWidth: "100%", height: "auto" }} />
  return <Card variant="surface"><Code style={{ whiteSpace: "pre-wrap" }}>{value.body}</Code></Card>
}
