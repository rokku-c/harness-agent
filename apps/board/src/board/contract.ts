/** board/contract.ts - the FACETED API CONTRACT of BoardService.
 *  Concept: the outside world (MCP tools, web translator, executors) talks
 *  only through BoardApi; it is the only place allowed to combine Store +
 *  ResourceGovernor + EventBus. Options + snapshot shapes live here. */
import { Effect } from "effect"
import type { Concurrency, ExecutorKind, ResourceKind, WorkItem } from "../domain.ts"
import type { Tables } from "../store.ts"
import type { ResourceGovernor } from "../governor.ts"
import type { EventBus, BoardEvent } from "../events.ts"

export interface BoardOptions {
  /** optional snapshot file for restart persistence (BOARD_DATA_FILE) */
  readonly dataFile?: string
}

export interface BoardSnapshot {
  readonly resources: ReadonlyArray<{ resourceId: string; name: string; kind: ResourceKind; capacity: number; concurrency: Concurrency; used: number }>
  readonly items: ReadonlyArray<WorkItem>
  readonly executors: ReadonlyArray<{ executorId: string; name: string; kind: ExecutorKind; status: string; capability: ReadonlyArray<string> }>
  readonly views: ReadonlyArray<{ name: string; columns: ReadonlyArray<{ id: string; title: string; states: ReadonlyArray<string> }> }>
}

export interface BoardApi {
  readonly tables: Tables
  readonly bus: EventBus
  readonly governor: ResourceGovernor
  readonly state: () => Effect.Effect<BoardSnapshot>
  readonly createItem: (input: {
    title: string
    body?: string
    priority?: "low" | "normal" | "high" | "urgent"
    requires?: ReadonlyArray<{ resourceId: string; amount?: number }>
    assigneeId?: string
    parentId?: string
    dependencies?: ReadonlyArray<string>
    labels?: ReadonlyArray<string>
  }) => Effect.Effect<{ itemId: string }>
  readonly getItem: (itemId: string) => Effect.Effect<WorkItem | undefined>
  readonly listItems: () => Effect.Effect<WorkItem[]>
  readonly viewItems: (viewName?: string) => Effect.Effect<Record<string, unknown>>
  readonly start: (itemId: string, executorId: string) => Effect.Effect<{ ok: boolean; state: string; detail?: string }>
  readonly report: (itemId: string, outcome: "done" | "failed", detail?: string) => Effect.Effect<{ ok: boolean; detail?: string }>
  readonly cancel: (itemId: string) => Effect.Effect<{ ok: boolean; detail?: string }>
  readonly block: (itemId: string, reason: string) => Effect.Effect<{ ok: boolean; detail?: string }>
  readonly unblock: (itemId: string) => Effect.Effect<{ ok: boolean; detail?: string }>
  readonly registerExecutor: (executorId: string, kind: "builtin" | "external", name: string, capability: string[]) => Effect.Effect<{ ok: boolean }>
  readonly heartbeat: (executorId: string) => Effect.Effect<{ ok: boolean }>
  readonly createResource: (input: {
    resourceId: string
    kind: "workspace" | "slot" | "external"
    name: string
    capacity: number
    concurrency: "exclusive" | "shared"
  }) => Effect.Effect<{ ok: boolean; detail?: string }>
  readonly eventsAfter: (ts: number) => Effect.Effect<ReadonlyArray<BoardEvent>>
}

export interface BoardDeps {
  readonly tables: Tables
  readonly bus: EventBus
  readonly governor: ResourceGovernor
  readonly dataFile: string | undefined
}
