import type { EffectPlugin, EffectPluginHost } from "@effect-agent/effect-host"
import type { EgressRouter } from "@effect-agent/effect-network"

/** No listener here: network control itself is another registered service. */
export const networkPlugin = (host: EffectPluginHost, network: EgressRouter): EffectPlugin => ({
  id: "platform-network", priority: 0,
  routes: [{ path: "/-/network/egress" }, { path: "/-/network/routes", method: "GET" }],
  load: async () => ({ handle: async (request) => {
    if (new URL(request.url).pathname === "/-/network/routes") return Response.json(host.routes())
    return network.handleRelay(request)
  } }),
})
