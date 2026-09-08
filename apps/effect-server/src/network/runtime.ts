import { makeEgressRouter, type EgressPolicy, type EgressRouter } from "@effect-agent/effect-network"
import { networkSchema } from "./config.ts"

/** Stable SDK handle, with replaceable node transport and application policies. */
export const makeNetworkRuntime = (getConfig: () => unknown) => {
  let egress = makeEgressRouter(networkSchema.parse(getConfig()))
  const apps = new Map<string, EgressPolicy>()
  const network: EgressRouter = {
    registerApp(id, policy = "main-first") {
      apps.set(id, policy)
      egress.registerApp(id, policy)
      const generation = {}
      owners.set(id, generation)
      return () => {
        if (owners.get(id) !== generation) return
        owners.delete(id); apps.delete(id)
        rebuild()
      }
    },
    fetch: (id, input, init) => egress.fetch(id, input, init),
    handleRelay: (request) => egress.handleRelay(request),
  }
  const owners = new Map<string, object>()
  const rebuild = () => {
    egress = makeEgressRouter(networkSchema.parse(getConfig()))
    for (const [id, policy] of apps) egress.registerApp(id, policy)
  }
  return { network, reload: rebuild }
}
