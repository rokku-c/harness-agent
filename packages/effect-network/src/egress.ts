import { EgressError, type EgressOptions, type EgressPolicy, type EgressRouter } from "./types.ts"
import { chooseExit, policies } from "./policy.ts"
import { targetRequest, targetURL } from "./request.ts"
import { relayRequest } from "./relay-client.ts"
import { serveRelay } from "./relay-server.ts"

export const makeEgressRouter = (options: EgressOptions): EgressRouter => {
  if (!["main", "peer"].includes(options.role)) throw new EgressError(400, "Unknown node role")
  if (options.main) {
    targetURL(options.main.url)
    if (!options.main.token) throw new EgressError(400, "Main node requires a token")
  }
  const apps = new Map<string, { policy: EgressPolicy }>()
  return {
    registerApp(id, policy = "main-first") {
      if (!id || /\s/.test(id) || !policies.includes(policy)) throw new EgressError(400, "Invalid app egress declaration")
      const entry = { policy }; apps.set(id, entry)
      return () => { if (apps.get(id) === entry) apps.delete(id) }
    },
    fetch: async (id, input, init) => {
      const app = apps.get(id)
      if (!app) throw new EgressError(403, "App is not registered for egress")
      const exit = chooseExit(options, app.policy)
      const request = targetRequest(input, init)
      return exit === "local" ? (options.localSend ?? fetch)(request)
        : relayRequest(id, request, options.main!, options.relaySend ?? fetch)
    },
    handleRelay: (request) => serveRelay(options, (id) => apps.get(id)?.policy, request),
  }
}
