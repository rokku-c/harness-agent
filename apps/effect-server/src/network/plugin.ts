import type { EffectPlugin, EffectPluginHost } from "@effect-agent/effect-host"
import type { EgressRouter } from "@effect-agent/effect-network"

/** No listener here: network control itself is another registered service. Its
 *  slot's id, dispatch order and route claims are `KERNEL_PLANES`'s. */
export const networkPlugin = (host: EffectPluginHost, network: EgressRouter): EffectPlugin => ({
  id: "platform-network",
  load: async () => ({ handle: async (request) => {
    if (new URL(request.url).pathname === "/-/network/routes") return Response.json(host.routes())
    return network.handleRelay(request)
  } }),
})
