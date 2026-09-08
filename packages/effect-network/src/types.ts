export type EgressPolicy = "local-first" | "main-first" | "local-only" | "main-only"
export type HttpSend = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
export interface MainNode { readonly url: string; readonly token: string }
export interface EgressOptions {
  readonly role: "main" | "peer"
  readonly main?: MainNode
  readonly relayToken?: string
  readonly localAvailable?: boolean
  readonly localSend?: HttpSend
  readonly relaySend?: HttpSend
}
export interface EgressRouter {
  registerApp(appId: string, policy?: EgressPolicy): () => void
  fetch(appId: string, input: string | URL | Request, init?: RequestInit): Promise<Response>
  handleRelay(request: Request): Promise<Response>
}
export class EgressError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = "EgressError" }
}
