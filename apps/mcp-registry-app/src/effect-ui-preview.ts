/**
 * Previewing a ui:// resource a server declares.
 *
 * One node renders the answer, and it is the only component in a view that is
 * ours (§11.3): a sandboxed frame, which no design system component is, because
 * what it shows is a document from a server this page does not trust. Its five
 * outcomes are decided inside it, in their order — a failure the resource
 * reported, nothing chosen yet, a page, an image, any other body as text — so
 * the whole answer is bound to it and nothing about the answer is decided here.
 * A node per outcome on this screen would be a second copy of that order, free
 * to disagree with the first, which is the failure the one node prevents.
 *
 * The server field is bound to the address's own parameter rather than to a
 * second copy of it, which is what lets a row's Preview carry the id it stands
 * on: an operator who wants to see a resource should not have to retype the id
 * it is already listed under. The field stays editable, because what the row
 * carried is a starting value and not a lock.
 *
 * The body is the one thing in a region. A resource is a document of someone
 * else's making and can be any height, and the form and the press that produced
 * it keep their place above it rather than scrolling away under it.
 */
import { field, heading, press, region, row, text, NAV_ROOT, type UiActionSpec, type UiNodeSpec } from "@effect-agent/effect-ui"

const SERVER = `${NAV_ROOT}/serverId`
const URI = `${NAV_ROOT}/uri`
const RESULT = "/preview/result"

const form: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  children: [
    field("Server id", { component: "TextField.Root", bind: SERVER }),
    field("Resource URI", { component: "TextField.Root", props: { placeholder: "ui://server/console" }, bind: URI }),
    row([press("Load preview", "registry.preview", undefined, { variant: "solid", size: "2" })]),
  ],
}

export const previewScreen: readonly UiNodeSpec[] = [
  heading("Preview a resource", { size: "4" }),
  text("Reads a ui:// resource a server declares, over that server's own MCP endpoint.", { size: "2", color: "gray" }),
  form,
  region([{ component: "Preview", props: { height: 420 }, bind: RESULT }]),
]

export const previewAction: UiActionSpec = {
  name: "registry.preview",
  method: "GET",
  url: "/-/registry/preview",
  params: { serverId: { state: SERVER }, uri: { state: URI } },
  result: RESULT,
}
