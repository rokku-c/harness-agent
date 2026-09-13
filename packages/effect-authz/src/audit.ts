/**
 * effect-authz — audit port.
 *
 * Emitted once per decision, denials included. The recorder is deliberately
 * synchronous: the decision path must stay synchronous so the projection can be
 * the very same function, and a fire-and-forget promise would swallow failures.
 * Persistence (sqlite, observe) is the caller's concern.
 */

import type { Action } from "./action.ts"
import type { Source } from "./policy.ts"
import type { PrincipalKind } from "./principal.ts"

export interface AuthzEvent {
  readonly at: number
  readonly principalKey: string
  readonly kind: PrincipalKind
  readonly action: Action
  readonly resource: string
  readonly allowed: boolean
  readonly reason: string
  /** Absent for a default deny — nothing matched, so nothing is the source. */
  readonly source?: Source
}

export interface AuthzRecorder {
  record(event: AuthzEvent): void
}

export const noopRecorder: AuthzRecorder = { record: () => {} }
