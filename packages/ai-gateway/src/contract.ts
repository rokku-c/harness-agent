export interface GatewayContext {
  readonly requestId: string
  readonly agent?: string
  readonly session?: string
  readonly model?: string
  readonly path: string
}

export interface GatewayEvent {
  readonly requestId: string
  readonly type: "request" | "injection" | "response" | "error"
  readonly at: number
  readonly agent?: string
  readonly session?: string
  readonly detail: Record<string, unknown>
}

export interface GatewayRecorder { record(event: GatewayEvent): Promise<void> | void }
export interface GatewayUpstream { send(request: Request): Promise<Response> }

export interface GatewayRule {
  readonly ruleId: string
  readonly match?: { readonly agent?: string; readonly session?: string; readonly model?: string; readonly path?: string }
  readonly inject: { readonly content: string; readonly position?: "system-prefix" | "system-suffix" }
}
