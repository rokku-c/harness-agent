import type { EffectAppDescriptor } from "@effect-agent/effect-apps"

export const effectApp: EffectAppDescriptor = {
  id: "bad-app", title: "Bad app", path: "/bad",
  createPlugin: () => ({ id: "bad-app", load: async () => ({
    handle: async () => new Response("bad app", { headers: { "content-type": "text/plain" } }),
  }) }),
}
