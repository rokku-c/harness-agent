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
  readonly source?: Source
}

export interface AuthzRecorder {
  record(event: AuthzEvent): void
}

export const noopRecorder: AuthzRecorder = { record: () => {} }
