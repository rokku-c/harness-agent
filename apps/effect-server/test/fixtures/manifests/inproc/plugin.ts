import type { EffectAppDescriptor } from "@effect-agent/effect-apps"

export const effectApp: EffectAppDescriptor = {
  id: "demo-inproc", title: "Demo inproc", path: "/demo",
  routes: [{ path: "/demo" }],
  createPlugin: () => ({ id: "demo-inproc", load: async () => ({
    handle: async () => new Response("demo inproc", { headers: { "content-type": "text/plain" } }),
  }) }),
}
