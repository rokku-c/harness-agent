/**
 * The one component in a view that is ours.
 *
 * Every other node is a design-system component: this layer matches a name to a
 * component and lets the design system decide how it looks. This one has no
 * equivalent there, because what it shows is not ours either — it is a `ui://`
 * resource some app's own API returned, a document this page must display
 * without trusting. A sandboxed frame is the only thing that does that, and the
 * sandbox is the whole reason the node exists rather than an `embed` kind, which
 * the UI boundary check rejects for exactly the reach a frame like this must not
 * have: `allow-scripts` without `allow-same-origin` leaves the framed document
 * on an opaque origin, so it can run but cannot touch this page's storage or DOM.
 *
 * Five outcomes, in the order they are decided: a failure the resource reported,
 * nothing chosen yet, a page, an image, and any other body as text.
 */

import * as React from "react"
import { Callout, Card, Code, Text } from "@radix-ui/themes"
import type { ComponentRenderer } from "@json-render/react"
import { propsOf } from "./contract.ts"

/** What a resource preview call hands back; only `kind` and `body` decide the branch. */
interface PreviewValue {
  readonly kind?: string
  readonly mimeType?: string
  readonly body?: string
  readonly uri?: string
  readonly error?: string
}

/** Anything that is not an object is a resource that has not arrived yet, not a failure. */
const resourceOf = (value: unknown): PreviewValue =>
  typeof value === "object" && value !== null ? value as PreviewValue : {}

export const Preview: ComponentRenderer = (ctx) => {
  const props = propsOf(ctx)
  const value = resourceOf(props.value)
  // `height` is an attribute of the frame rather than content, so it is read
  // here and nowhere else; a spec that omits it gets the default below.
  const height = props.height === undefined ? undefined : String(props.height)
  if (typeof value.error === "string") return <Callout.Root color="red" size="1"><Callout.Text>{value.error}</Callout.Text></Callout.Root>
  if (typeof value.body !== "string") return <Card variant="surface"><Text size="2" color="gray">Select a resource to preview.</Text></Card>
  if (value.kind === "html") return <iframe title={value.uri ?? "Resource preview"} sandbox="allow-scripts" srcDoc={value.body} style={{ width: "100%", border: 0, height: height ?? "420px", background: "white" }} />
  if (value.kind === "image") return <img alt={value.uri ?? "Resource preview"} src={`data:${value.mimeType ?? "image/png"};base64,${value.body}`} style={{ maxWidth: "100%", height: "auto" }} />
  return <Card variant="surface"><Code style={{ whiteSpace: "pre-wrap" }}>{value.body}</Code></Card>
}
