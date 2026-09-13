/**
 * Previewing a ui:// resource a registered server declares.
 *
 * Every press replaces the whole result, so the renderings below cannot hold at
 * once: a failure takes the body of an earlier success with it, and a body of
 * any kind is a result, which is what the placeholder's guard reads. The result
 * is presented with the design system's own components wherever it can be —
 * nothing asked yet, a failure, a text body — so the one component of ours, the
 * sandboxed `Preview`, is left with the kinds a Radix component genuinely
 * cannot show: a page, an image. Those two are one node guarded by an `any` of
 * two equalities rather than two nodes.
 */

import { row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { failure, field, section, text } from "./effect-ui-nodes.ts"

/** A preview body that is only text: a card and a code block, no sandbox needed. */
const textBody: UiNodeSpec =
  ({ component: "Card", props: { variant: "surface" },
    visible: { source: { state: "/preview/result/kind" }, equals: "text" },
    children: [{ component: "Code", props: { style: { whiteSpace: "pre-wrap" } }, bind: "/preview/result/body" }] })

/** The kinds that need a document of their own: an html page, an image. */
const sandboxed: UiNodeSpec =
  ({ component: "Preview", props: { height: 420 }, bind: "/preview/result",
    visible: { any: [
      { source: { state: "/preview/result/kind" }, equals: "html" },
      { source: { state: "/preview/result/kind" }, equals: "image" },
    ] } })

export const previewSection: UiNodeSpec = section("Preview a ui:// resource", [
  text("Reads a resource a server declares, over that server's own MCP endpoint.", { size: "2", color: "gray" }),
  field("Server id", { component: "TextField.Root", bind: "/preview/serverId" }),
  field("Resource URI", { component: "TextField.Root", props: { placeholder: "ui://server/console" }, bind: "/preview/uri" }),
  row([{ component: "Button", props: { value: "Load preview" }, onPress: "registry.preview",
    params: { serverId: { state: "/preview/serverId" }, uri: { state: "/preview/uri" } } }]),
  failure("/preview/result/error"),
  { component: "Card", props: { variant: "surface" }, visible: { source: { state: "/preview/result" }, not: true },
    children: [{ component: "Text", props: { value: "Load a resource to see it here.", size: "2", color: "gray" } }] },
  textBody,
  sandboxed,
])
