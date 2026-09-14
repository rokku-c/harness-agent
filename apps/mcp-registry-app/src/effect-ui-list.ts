import { heading, press, region, row, text, type UiActionSpec, type UiNodeSpec } from "@effect-agent/effect-ui"
import { registryRead } from "./effect-ui-registry-source.ts"
import { serversTable } from "./effect-ui-servers.ts"

const doors: UiNodeSpec = row([
  press("Register a server", "registry.openRegister", undefined, { variant: "solid", size: "2" }),
  press("Preview a resource", "registry.openPreview", undefined, { variant: "soft", size: "2" }),
])

const start: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  children: [
    heading("Servers", { size: "4" }),
    text("One row per registered MCP server, with its version, era, status and the ui:// resources it declares.", { size: "2", color: "gray" }),
    doors,
  ],
}

export const serversScreen: readonly UiNodeSpec[] = [start, registryRead, region([serversTable])]

export const navigation: readonly UiActionSpec[] = [
  { name: "registry.openRegister", opens: "register" },
  { name: "registry.openWithdraw", opens: "withdraw" },
  { name: "registry.openRotate", opens: "rotate" },
  { name: "registry.openPreview", opens: "preview" },
]
