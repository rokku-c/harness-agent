export interface ParityAction {
  readonly name: string
  readonly description?: string
  readonly inputSchema?: unknown
}

export interface ParityAppView {
  readonly ns: string
  readonly appId: string
  readonly view?: unknown
  readonly state?: unknown
  readonly actions: readonly ParityAction[]
}
