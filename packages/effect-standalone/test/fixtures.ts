import { z } from "@effect-agent/effect-config"
import type { EffectAppDescriptor } from "@effect-agent/effect-apps"

/** What the fixture apps recorded, so a test can see disposal rather than assume it. */
export const record = { stops: [] as string[] }

const schema = <T extends z.ZodType>(appId: string, shape: T) => ({ appId, schema: shape })

/** An app that needs nothing but itself — the case this host exists for. */
export const soloApp = (): EffectAppDescriptor => ({
  id: "solo",
  title: "Solo",
  path: "/solo",
  routes: [{ path: "/solo", match: "prefix" }],
  config: schema("solo", z.object({ label: z.string().default("solo") })),
  createPlugin: (getConfig) => ({
    id: "solo",
    load: async () => ({
      tools: [{ name: "solo_read", description: "read the app's own config", input: z.object({}).strict(), handler: () => getConfig() }],
      handle: async (request) => new Response(`solo face ${new URL(request.url).pathname}`),
      stop: () => { record.stops.push("solo") },
    }),
  }),
})

/** An app that declares a dependency on another app. */
export const needyApp = (): EffectAppDescriptor => ({
  id: "needy",
  title: "Needy",
  requires: ["board"],
  plugin: { id: "needy", load: async () => ({ handle: async () => new Response("needy") }) },
})

/** An app whose plugin needs the shared MCP registry the way `mcp-registry` does. */
export const registryApp = (): EffectAppDescriptor => ({
  id: "registry-reader",
  title: "Registry reader",
  createPlugin: (_getConfig, context) => ({
    id: "registry-reader",
    load: async () => ({
      tools: [{
        name: "registry_probe", description: "was a shared registry injected?",
        input: z.object({}).strict(), handler: () => ({ injected: context.mcpRegistry !== undefined }),
      }],
      handle: async () => new Response("registry-reader"),
    }),
  }),
})
