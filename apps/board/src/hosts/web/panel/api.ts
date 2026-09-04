/** thin board client: every call maps 1:1 onto the board MCP tools (server.ts) */
export interface Claim { resourceId: string; amount?: number }
export interface WorkItem {
  itemId: string; title: string; state: string; priority?: string
  assigneeId?: string; body?: string; requires?: Claim[]; dependencies?: string[]
  children?: string[]; blockedReason?: string; result?: string
  labels?: string[]; createdAt: number; updatedAt: number
}
export interface ResInfo { resourceId: string; name: string; kind: string; capacity: number; concurrency: string; used: number }
export interface ExecInfo { executorId: string; name: string; kind: string; status: string; capability: string[] }
export interface ColInfo { id: string; title: string; states: string[]; itemIds: string[] }
export interface Snapshot { items: WorkItem[]; resources: ResInfo[]; executors: ExecInfo[] }
export interface BoardEvent { ts: number; type: string; message?: string }
export interface ActionResult { ok: boolean; detail?: string; state?: string; summary?: string }

const json = async (res: Response): Promise<unknown> => {
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { ok: false, detail: "bad response: " + text.slice(0, 120) } }
}
const post = (b: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })

export interface ClaudeIntegrationState {
  applied: boolean
  connected: boolean
  claudeCliExists: boolean
  files: { mcpJson: boolean; claudeMd: boolean; wrapper: boolean; systemPrompt: boolean }
  error?: string
  home?: string
  boardInUserJson?: boolean
}
export interface ClaudeActionResult {
  ok: boolean
  detail?: string
  scope?: string
  state?: ClaudeIntegrationState
  summary?: string
}

export const api = {
  state: async (): Promise<Snapshot> => (await json(await fetch("/api/state"))) as Snapshot,
  view: async (): Promise<ColInfo[]> => {
    const r = (await json(await fetch("/api/view"))) as { view?: { columns: ColInfo[] } }
    return r.view?.columns ?? []
  },
  events: async (ts: number): Promise<BoardEvent[]> => {
    const r = (await json(await fetch("/api/events?ts=" + ts))) as { events?: BoardEvent[] }
    return r.events ?? []
  },
  createItem: async (b: Record<string, unknown>): Promise<ActionResult & { itemId?: string }> =>
    (await json(await fetch("/api/item", post(b)))) as ActionResult & { itemId?: string },
  createResource: async (b: Record<string, unknown>): Promise<ActionResult> =>
    (await json(await fetch("/api/resource", post(b)))) as ActionResult,
  act: async (kind: string, itemId: string, extra: Record<string, unknown> = {}): Promise<ActionResult> =>
    (await json(await fetch("/api/item/" + kind, post({ itemId, ...extra })))) as ActionResult,
  coordinate: async (itemId: string): Promise<ActionResult> =>
    (await json(await fetch("/api/coordinate", post({ itemId })))) as ActionResult,
  integrationGet: async (probe = false, scope = "repo"): Promise<ClaudeActionResult> =>
    (await json(await fetch("/api/integration/claude?probe=" + (probe ? "1" : "0") + "&scope=" + scope))) as ClaudeActionResult,
  integrationAction: async (action: string, scope = "repo"): Promise<ClaudeActionResult> =>
    (await json(await fetch("/api/integration/claude", post({ action, scope })))) as ClaudeActionResult
}
