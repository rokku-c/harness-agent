export interface ConsentRequest {
  readonly askId: string
  readonly runId: string
  readonly agentId: string
  readonly tool: string
  readonly input?: string
  readonly allow?: boolean
  readonly by?: string
  readonly createdAt: number
  readonly resolvedAt?: number
}
