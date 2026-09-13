/**
 * The one component that is ours: a resource preview.
 *
 * Everything else in a view is a design-system component. This one is not,
 * because what it shows is not ours either — it is a `ui://` resource an app's
 * API returned, and the sandbox is the whole reason the node exists at all
 * rather than an `embed` kind, which the UI boundary check rejects.
 */

import * as React from "react"
import { Callout, Card, Code, Text } from "@radix-ui/themes"
import type { ComponentRenderProps } from "@json-render/react"

interface PreviewValue { readonly kind?: string; readonly mimeType?: string; readonly body?: string; readonly uri?: string; readonly error?: string }

export const Preview = ({ ctx }: { ctx: ComponentRenderProps }) => {
  const props = (ctx.element.props ?? {}) as { value?: unknown; height?: string | number }
  const value = (typeof props.value === "object" && props.value !== null ? props.value : {}) as PreviewValue
  const height = props.height === undefined ? undefined : String(props.height)
  if (typeof value.error === "string") return <Callout.Root color="red" size="1"><Callout.Text>{value.error}</Callout.Text></Callout.Root>
  if (typeof value.body !== "string") return <Card variant="surface"><Text size="2" color="gray">Select a resource to preview.</Text></Card>
  if (value.kind === "html") return <iframe title={value.uri ?? "Resource preview"} sandbox="allow-scripts" srcDoc={value.body} style={{ width: "100%", border: 0, height: height ?? "420px", background: "white" }} />
  if (value.kind === "image") return <img alt={value.uri ?? "Resource preview"} src={`data:${value.mimeType ?? "image/png"};base64,${value.body}`} style={{ maxWidth: "100%", height: "auto" }} />
  return <Card variant="surface"><Code style={{ whiteSpace: "pre-wrap" }}>{value.body}</Code></Card>
}
