/**
 * console/console.ts - the WebConsole FACADE (state source of the web panel).
 *
 * Concept: the panel polls SNAPSHOTS and never subscribes to an event stream.
 * Every conversation turn runs through the shared MantisHost (turn-runner.ts
 * owns busy exclusion + AsyncLocalStorage attribution + begin/end recording),
 * while this shell wires the seams: console-as-operator approvals, shared workspace, and the polled snapshot readers.
 */
import { ManualGate, type PendingApproval } from "@effect-agent/gate"
import { Bus } from "../bus.ts"
import { MantisHost } from "../../dingtalk/host.ts"
import { NotesStore } from "../../../tools.ts"
import type { ConsoleTimelineEntry, WebConsoleOptions } from "./types.ts"
import { TimelineLedger } from "./ledger.ts"
import { buildConsoleApproval, resolveApproval as resolveApprovalOp, pendingApprovals as pendingOp } from "./approvals.ts"
import { buildConsoleHost } from "./host-builder.ts"
import { timelineOf, conversationsOf, pendingOf, workspaceSurface, consoleState } from "./snapshot.ts"
import { TurnRunner } from "./turn-runner.ts"

export class WebConsole {
  readonly bus: Bus
  readonly host: MantisHost
  readonly gate: ManualGate | undefined
  readonly workspace: ReturnType<typeof workspaceSurface>
  readonly startedAt = Date.now()
  readonly #workspace: NotesStore | undefined
  readonly #ledger = new TimelineLedger()
  readonly #runner: TurnRunner

  constructor(options: WebConsoleOptions) {
    this.bus = options.bus ?? new Bus()
    this.#workspace = options.workspaceFile === undefined ? undefined : new NotesStore({ file: options.workspaceFile })
    const { gate, approval } = buildConsoleApproval(options.protectedTools ?? [], options.approveTimeoutMs, this.bus)
    this.gate = gate
    this.host = buildConsoleHost({
      model: options.model,
      instructions: options.instructions,
      maxSteps: options.maxSteps,
      maxReflections: options.maxReflections,
      workspace: this.#workspace,
      memoryDir: options.memoryDir,
      logger: options.logger,
      bus: this.bus,
      runCtx: () => this.#runner.current(),
      approval,
      recordNote: (conversationId, text) => this.#ledger.recordNote(conversationId, text),
      recordTool: (conversationId, tool, state, detail) => this.#ledger.recordTool(conversationId, tool, state, detail)
    })
    this.#runner = new TurnRunner(this.bus, this.#ledger, this.host)
    this.workspace = workspaceSurface(this.host, this.#workspace)
  }

  readonly handleMessage = (conversationId: string, text: string): Promise<{ accepted: boolean; detail?: string }> => this.#runner.handleMessage(conversationId, text)
  readonly chatSync = (conversationId: string, text: string): Promise<{ ok: boolean; reply?: string; detail?: string }> => this.#runner.chatSync(conversationId, text)
  readonly chatFire = (conversationId: string, text: string): { ok: boolean; detail?: string } => this.#runner.chatFire(conversationId, text)
  /** the operator answered a pending approval (console UI / MCP approve) */
  readonly resolveApproval = (callId: string, allow: boolean): Promise<{ ok: boolean; detail?: string }> => resolveApprovalOp(this.gate, this.bus, callId, allow)
  readonly conversationTimeline = (conversationId: string): ReadonlyArray<ConsoleTimelineEntry> => timelineOf(this.#ledger, this.host, conversationId)
  readonly conversations = (): Array<{ conversationId: string; turns: number }> => conversationsOf(this.host, this.#ledger)
  readonly pendingApprovals = (): ReadonlyArray<PendingApproval> => pendingOp(this.gate)
  readonly state = () => consoleState(this.host, this.#ledger, this.gate, this.startedAt)
}
