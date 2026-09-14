import { sourceStatusPath, type UiActionSpec, type UiNodeSpec, type UiSourceSpec } from "@effect-agent/effect-ui"
import { refused, retry } from "./effect-ui-refusal.ts"

export const uiHostSources = [
  { id: "runtime", url: "/ui/api/runtime", state: "/runtime", refreshMs: 5000 },
  { id: "canvases", url: "/ui/api/canvases", state: "/canvases", refreshMs: 5000 },
  { id: "components", url: "/ui/api/components", state: "/components" },
  { id: "extensions", url: "/ui/api/extensions", state: "/extensions" },
  { id: "activity", url: "/ui/api/activity", state: "/activity", refreshMs: 5000 },
] as const satisfies readonly UiSourceSpec[]

export type UiHostSource = (typeof uiHostSources)[number]["id"]

export const readRetries: Record<UiHostSource, UiActionSpec> = {
  runtime: { name: "uiHost.retryRuntime", refresh: ["runtime"] },
  canvases: { name: "uiHost.retryCanvases", refresh: ["canvases"] },
  components: { name: "uiHost.retryComponents", refresh: ["components"] },
  extensions: { name: "uiHost.retryExtensions", refresh: ["extensions"] },
  activity: { name: "uiHost.retryActivity", refresh: ["activity"] },
}

export const readFailed = (id: UiHostSource, sentence: string): UiNodeSpec =>
  refused(sentence, `${sourceStatusPath(id)}/error`, retry(readRetries[id].name))
