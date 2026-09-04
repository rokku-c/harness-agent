/**
 * agent/options.ts - the SESSION OPTIONS + RESULT CONTRACT.
 *
 * Concept: what a host may inject into one mantis session (model, shared
 * workspace store, prompt override, step/reflection limits, pre-enabled
 * extended tools, approval policy, extra bindings, observability hooks, the
 * optional UI console) and what a session returns (agent + the supply/
 * store/approvals it ran with).
 */
import type { AgentError, AgentProgram, Binding, HarnessHook } from "@effect-agent/core"
import type { Model } from "@effect-agent/builtin"
import type { FinalReply } from "../final.ts"
import type { ApprovalPolicy } from "../approval.ts"
import type { ToolSupply } from "../supply.ts"
import type { NotesStore } from "../tools.ts"

export interface MantisOptions {
  readonly model: Model
  /**
   * Shared workspace store to use for this session (default: a fresh
   * per-session store). Hosts inject one instance so every conversation
   * shares the same durable workspace.
   */
  readonly notes?: NotesStore
  /** the session prompt; defaults to the mantis persona above */
  readonly instructions?: string
  readonly maxSteps?: number
  /** how many reflection passes a session may take (default 2) */
  readonly maxReflections?: number
  /**
   * Extended tools to pre-enable on this session (restores a conversation's
   * previously enabled surface across restarts). Core tools are always there.
   */
  readonly initialEnabled?: ReadonlyArray<string>
  /** called after an extended tool enable succeeds (host persists the surface) */
  readonly onEnabled?: (name: string) => void
  /**
   * Which tool calls wait for a human before executing. Default: none -
   * nothing is approved/denied unless this policy says so. Use
   * gateApproval(manualGate, (req) => ...) to route protected calls to an
   * operator console.
   */
  readonly approvals?: ApprovalPolicy
  /**
   * Extra read-only bindings materialized into the context on every run -
   * e.g. a per-conversation history binding from the host, so a session
   * agent sees its prior turns (conversation memory without storing it in
   * the agent definition).
   */
  readonly bindings?: ReadonlyArray<Binding>
  /**
   * Observability hooks (see Harness.withHooks): e.g. a logger hook from
   * ./logging.ts, so every session event flows into a unified log.
   */
  readonly hooks?: ReadonlyArray<HarnessHook<never, never>>
  /**
   * Optional UI console connection (web console host): enables the ui_render
   * tool, so a session can push A2UI-style surfaces onto the operator console.
   */
  readonly ui?: { readonly push: (spec: unknown) => void }
}

export interface Mantis {
  /** the session agent: message -> FinalReply */
  readonly agent: AgentProgram<string, FinalReply, AgentError, never>
  readonly supply: ToolSupply
  readonly notes: NotesStore
  /** the approval policy in effect (noApproval when none was configured) */
  readonly approvals: ApprovalPolicy
}
