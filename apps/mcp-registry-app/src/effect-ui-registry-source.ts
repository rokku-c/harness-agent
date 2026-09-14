import { emptyNotice, loadingRows, sourceStatusPath, type UiActionSpec, type UiNodeSpec } from "@effect-agent/effect-ui"
import { refused, retry } from "./effect-ui-refusal.ts"

export const REGISTRY = "registry"
export const SERVERS = "/registry/servers"

export const registryRead: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "2" },
  children: [
    loadingRows(REGISTRY, 6),
    emptyNotice(REGISTRY, "No servers are registered. Choose Register a server to add one."),
    refused("Could not read the server list.", `${sourceStatusPath(REGISTRY)}/error`, retry("registry.retry")),
  ],
}

export const registryRetryAction: UiActionSpec = { name: "registry.retry", refresh: [REGISTRY] }
