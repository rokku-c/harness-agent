/**
 * Board as an MCP server - layer ④ of the design, and the ONLY way external
 * agents (Claude Code, any MCP client) touch the board. Every tool is a thin
 * mapping over BoardApi and answers with one JSON text blob so the client
 * can parse it losslessly; errors are {"ok":false,"detail":...}.
 *
 * Schemas are declared as z.ZodRawShape (runtime zod, but annotated so the
 * SDK's type-level normalization stays shallow).
 */
import { Effect } from "effect"
import { z } from "zod"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { BoardApi } from "../../board.ts"
import { coordinate } from "../../coordinator.ts"
import type { Model } from "@effect-agent/builtin"

export interface BoardMcpOptions {
  readonly board: BoardApi
  /** when given, the builtin coordinator tool is registered (it needs a model) */
  readonly model?: Model
  /** server name shown to the MCP client (default "board") */
  readonly name?: string
}

const json = (payload: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(payload) }] })
const str = (a: Record<string, unknown>, key: string): string | undefined => (typeof a[key] === "string" ? a[key] as string : undefined)

const KINDS = ["workspace", "slot", "external"] as const
const CONCURRENCIES = ["exclusive", "shared"] as const
const PRIORITIES = ["low", "normal", "high", "urgent"] as const
const EXEC_KINDS = ["builtin", "external"] as const

const splitList = (value: string | undefined): Array<string> | undefined => {
  if (value === undefined) return undefined
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) return parsed.map((x) => String(x))
  } catch { /* comma list fallthrough */ }
  return value.split(",").map((x) => x.trim()).filter(Boolean)
}
const splitRequires = (value: string | undefined): Array<{ resourceId: string; amount?: number }> | undefined => {
  if (value === undefined) return undefined
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) {
      return parsed.map((r) => {
        const o = r as { resourceId?: unknown; amount?: unknown }
        return { resourceId: String(o.resourceId ?? ""), amount: typeof o.amount === "number" ? o.amount : undefined }
      }).filter((r) => r.resourceId !== "")
    }
  } catch { /* fallthrough */ }
  return value.split(",").map((x) => x.trim()).filter(Boolean).map((resourceId) => ({ resourceId }))
}

const SCHEMA = {
  state: {} as z.ZodRawShape,
  sync: { agentId: z.string().min(1).max(200), kind: z.enum(["agent", "probe"]), agentKind: z.string().optional(), capabilities: z.string().optional() } as z.ZodRawShape,
  createItem: {
    title: z.string().min(1).max(300),
    kind: z.enum(["goal", "group", "leaf"]).optional(),
    body: z.string().max(8000).optional(),
    priority: z.string().max(20).optional(),
    requires: z.string().max(4000).optional(),
    assigneeId: z.string().min(1).max(200).optional(),
    parentId: z.string().min(1).max(200).optional(),
    dependencies: z.string().max(4000).optional(),
    labels: z.string().max(4000).optional()
  } as z.ZodRawShape,
  id: { itemId: z.string().min(1).max(200) } as z.ZodRawShape,
  list: {} as z.ZodRawShape,
  tree: { nodeId: z.string().optional(), depth: z.number().int().nonnegative().optional() } as z.ZodRawShape,
  view: { view: z.string().optional() } as z.ZodRawShape,
  start: { itemId: z.string().min(1).max(200), executorId: z.string().min(1).max(200) } as z.ZodRawShape,
  report: { itemId: z.string().min(1).max(200), detail: z.string().max(8000).optional() } as z.ZodRawShape,
  cancel: { itemId: z.string().min(1).max(200) } as z.ZodRawShape,
  block: { itemId: z.string().min(1).max(200), reason: z.string().min(1).max(1000) } as z.ZodRawShape,
  unblock: { itemId: z.string().min(1).max(200) } as z.ZodRawShape,
  registerExecutor: {
    executorId: z.string().min(1).max(200),
    kind: z.string().max(20),
    name: z.string().min(1).max(200),
    capability: z.string().max(4000).optional()
  } as z.ZodRawShape,
  heartbeat: { executorId: z.string().min(1).max(200) } as z.ZodRawShape,
  resource: {
    resourceId: z.string().min(1).max(200),
    kind: z.string().max(20),
    name: z.string().min(1).max(200),
    capacity: z.number().int().positive(),
    concurrency: z.string().max(20)
  } as z.ZodRawShape,
  events: { ts: z.number().int().nonnegative() } as z.ZodRawShape,
  coordinate: { itemId: z.string().min(1).max(200) } as z.ZodRawShape
}

/** register one board tool; handlers receive a plain record and cast locally */
const tool = (
  server: McpServer,
  name: string,
  description: string,
  shape: z.ZodRawShape,
  handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: "text"; text: string }> }>
): void => {
  server.registerTool(
    name,
    { title: name, description, inputSchema: shape } as never,
    (args) => handler(args as Record<string, unknown>) as never
  )
}

export const makeBoardMcp = (options: BoardMcpOptions): McpServer => {
  const board = options.board
  const server = new McpServer({ name: options.name ?? "board", version: "0.1.0" })

  tool(server, "board_state", "Full board snapshot: resources (with current usage), all work items, executors, views.", SCHEMA.state, async () =>
    json(await Effect.runPromise(board.state())))

  tool(server, "board_sync", "Register an agent or probe and negotiate board.v2 capabilities.", SCHEMA.sync, async (a) => {
    const agentId = String(a.agentId ?? "")
    const kind = str(a, "kind")
    const result = await Effect.runPromise(board.registerExecutor(agentId, kind === "probe" ? "builtin" : "external", str(a, "agentKind") ?? kind ?? "agent", []))
    return json({ ...result, agentId, registered: result.ok, server: { protocol: "board.v2@1", tree: true, launch: false, consent: false } })
  })

  tool(server, "board_create_item",
    "Create a work item (state todo). title required; priority one of " + PRIORITIES.join("|") + "; " +
      "requires = JSON array of {resourceId, amount?} (or a comma list of resource ids); " +
      "dependencies / labels = JSON arrays (or comma lists); parentId attaches this as a child of a goal.",
    SCHEMA.createItem, async (a) => {
      const priority = str(a, "priority")
      const input = {
        title: String(a.title ?? ""),
        kind: str(a, "kind") as "goal" | "group" | "leaf" | undefined,
        body: str(a, "body"),
        priority: priority !== undefined && (PRIORITIES as ReadonlyArray<string>).includes(priority) ? priority as "low" | "normal" | "high" | "urgent" : undefined,
        requires: splitRequires(str(a, "requires")),
        assigneeId: str(a, "assigneeId"),
        parentId: str(a, "parentId"),
        dependencies: splitList(str(a, "dependencies")),
        labels: splitList(str(a, "labels"))
      }
      const result = await Effect.runPromise(board.createItem(input))
      return json({ ok: true, itemId: result.itemId })
    })

  tool(server, "board_get_item", "Read one work item by id.", SCHEMA.id, async (a) => {
    const item = await Effect.runPromise(board.getItem(String(a.itemId ?? "")))
    return json(item === undefined ? { ok: false, detail: "no such item" } : { ok: true, item })
  })

  tool(server, "board_list", "Every work item (newest first).", SCHEMA.list, async () =>
    json({ ok: true, items: await Effect.runPromise(board.listItems()) }))

  tool(server, "board_tree", "Read a task subtree in child order with leaf progress rollup.", SCHEMA.tree, async (a) => {
    const depth = typeof a.depth === "number" ? a.depth : undefined
    return json(await Effect.runPromise(board.tree(str(a, "nodeId"), depth)))
  })

  tool(server, "board_view", "A kanban projection of the board: each column lists the item ids in its states (default view board; Todo/Doing/Blocked/Done/Cancelled).", SCHEMA.view, async (a) =>
    json(await Effect.runPromise(board.viewItems(str(a, "view")))))

  tool(server, "board_start",
    "An executor starts itemId. Dependencies must be done; the item's resource claims are acquired atomically or the item parks as blocked (waiting for resources) and is granted by a later release automatically. Returns { ok, state }.",
    SCHEMA.start, async (a) => {
      const result = await Effect.runPromise(board.start(String(a.itemId ?? ""), String(a.executorId ?? "")))
      return json(result.ok ? { ok: true, state: result.state } : { ok: false, state: result.state, detail: result.detail })
    })

  const reportTool = (outcome: "done" | "failed") => async (a: Record<string, unknown>) => {
    const result = await Effect.runPromise(board.report(String(a.itemId ?? ""), outcome, str(a, "detail")))
    return json(result.ok ? { ok: true, outcome } : { ok: false, detail: result.detail })
  }
  tool(server, "board_report_done", "Finish a doing item; its resource claims are released (waiters wake).", SCHEMA.report, reportTool("done"))
  tool(server, "board_report_failed", "Mark a doing item failed; its resource claims are released.", SCHEMA.report, reportTool("failed"))

  tool(server, "board_cancel", "Cancel an item (drops any resource wait and releases claims).", SCHEMA.cancel, async (a) =>
    json(await Effect.runPromise(board.cancel(String(a.itemId ?? "")))))
  tool(server, "board_block", "Block an item for a human reason (releases claims).", SCHEMA.block, async (a) =>
    json(await Effect.runPromise(board.block(String(a.itemId ?? ""), String(a.reason ?? "blocked")))))
  tool(server, "board_unblock", "Unblock a blocked item back to ready.", SCHEMA.unblock, async (a) =>
    json(await Effect.runPromise(board.unblock(String(a.itemId ?? "")))))

  tool(server, "board_register_executor",
    "Join the board as an executor. kind builtin|external; capability = JSON array of labels (or comma list).",
    SCHEMA.registerExecutor, async (a) => {
      const kind = str(a, "kind")
      if (kind === undefined || !(EXEC_KINDS as ReadonlyArray<string>).includes(kind)) return json({ ok: false, detail: "kind must be builtin|external" })
      const result = await Effect.runPromise(board.registerExecutor(String(a.executorId ?? ""), kind as "builtin" | "external", String(a.name ?? a.executorId ?? ""), splitList(str(a, "capability")) ?? []))
      return json(result)
    })

  tool(server, "board_heartbeat", "Refresh an executor's lastSeen.", SCHEMA.heartbeat, async (a) =>
    json(await Effect.runPromise(board.heartbeat(String(a.executorId ?? "")))))

  tool(server, "board_create_resource",
    "Declare a resource for the governor. kind workspace|slot|external; capacity >= 1; concurrency exclusive (one holder at a time) or shared (many holders up to capacity).",
    SCHEMA.resource, async (a) => {
      const kind = str(a, "kind")
      const concurrency = str(a, "concurrency")
      if (kind === undefined || !(KINDS as ReadonlyArray<string>).includes(kind)) return json({ ok: false, detail: "kind must be workspace|slot|external" })
      if (concurrency === undefined || !(CONCURRENCIES as ReadonlyArray<string>).includes(concurrency)) return json({ ok: false, detail: "concurrency must be exclusive|shared" })
      const result = await Effect.runPromise(board.createResource({
        resourceId: String(a.resourceId ?? ""),
        kind: kind as "workspace" | "slot" | "external",
        name: String(a.name ?? a.resourceId ?? ""),
        capacity: typeof a.capacity === "number" ? a.capacity : Number(a.capacity ?? 1),
        concurrency: concurrency as "exclusive" | "shared"
      }))
      return json(result)
    })

  tool(server, "board_events",
    "Board events strictly after a wall-clock timestamp ts (ms epoch). Stateless: poll with the last seen ts to stream changes (item.created/state, resource.acquired/released, executor.registered, coordinator.started/finished).",
    SCHEMA.events, async (a) => {
      const events = await Effect.runPromise(board.eventsAfter(typeof a.ts === "number" ? a.ts : Number(a.ts ?? 0)))
      return json({ events })
    })

  if (options.model !== undefined) {
    tool(server, "board_coordinate",
      "Run the builtin coordinator agent over a goal item: it reads the board and the goal, breaks the goal into concrete subtasks (created as children of the goal item) and returns { summary, created }. External executors then start the subtasks.",
      SCHEMA.coordinate, async (a) => {
        const result = await Effect.runPromise(coordinate(board, String(a.itemId ?? ""), { model: options.model as Model }))
        return json(result.ok ? { ok: true, summary: result.detail, created: result.reply?.created ?? [] } : { ok: false, detail: result.detail })
      })
  }

  return server
}
