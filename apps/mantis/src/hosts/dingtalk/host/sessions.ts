/**
 * host/sessions.ts - the PER-CONVERSATION SESSION REGISTRY.
 *
 * Concept: one mantis instance per conversation - lazily created on the
 * first message with that conversation's durable workspace (when shared),
 * restored enabled surface, history binding (re-rendered every run) and
 * conversation-scoped approval policy + hooks.
 */
import type { Logger } from "@effect-agent/logger"
import type { HarnessHook } from "@effect-agent/core"
import { makeMantis } from "../../../agent.ts"
import { sessionLogHook } from "../../../logging.ts"
import { ConversationStore } from "../conversation.ts"
import { makeApprovalPolicy } from "./policy.ts"
import type { MantisHostOptions } from "./contract.ts"

export type MantisSession = ReturnType<typeof makeMantis>

export class SessionRegistry {
  readonly #sessions = new Map<string, MantisSession>()

  constructor(
    private readonly options: MantisHostOptions,
    readonly conversations: ConversationStore,
    private readonly logger: Logger
  ) {}

  /** one session agent per conversation - lazily created on first message */
  readonly session = (conversationId: string): MantisSession => {
    let session = this.#sessions.get(conversationId)
    if (session === undefined) {
      session = makeMantis({
        notes: this.options.workspace,
        initialEnabled: this.conversations.enabled(conversationId),
        onEnabled: (name) => this.conversations.recordEnabled(conversationId, name),
        model: this.options.model,
        instructions: this.options.instructions?.(conversationId),
        maxSteps: this.options.maxSteps,
        maxReflections: this.options.maxReflections,
        bindings: [this.conversations.historyBinding(conversationId)],
        approvals: makeApprovalPolicy(this.options.approval, conversationId),
        hooks: [
          sessionLogHook(this.logger.child("session." + conversationId)),
          ...(this.options.extraHooks ?? [])
        ]
      })
      this.#sessions.set(conversationId, session)
    }
    return session
  }
}
