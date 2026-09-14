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
  url: "/mcp-registry/preview",
  params: { serverId: { state: SERVER }, uri: { state: URI } },
  result: RESULT,
}
