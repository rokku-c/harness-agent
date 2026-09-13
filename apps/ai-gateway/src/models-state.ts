import { gatewayConfig } from "./config.ts"

const providerState = (provider: { readonly id: string; readonly apiType: string; readonly baseURL: string; readonly enabled?: boolean; readonly apiKey?: string }) => ({
  id: provider.id,
  apiType: provider.apiType,
  baseURL: provider.baseURL,
  enabled: provider.enabled !== false,
  credential: provider.apiKey === undefined ? "missing" : "configured",
})

/** Public model-plane state: provider credentials are represented by status only. */
export const modelsState = (getConfig: () => unknown) => {
  const config = gatewayConfig(getConfig())
  return {
    providers: (config.providers ?? []).map(providerState),
    rules: config.rules ?? [],
    captureBodies: config.captureBodies === true,
    endpoints: ["/v1/chat/completions", "/v1/responses", "/v1/messages"],
  }
}
