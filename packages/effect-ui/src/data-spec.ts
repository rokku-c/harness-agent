import type { UiActionParam } from "./value-spec.ts"

export interface UiSourceSpec {
  readonly id: string
  readonly url: string
  readonly state: string
  readonly refreshMs?: number
}

export interface UiActionSpec {
  readonly name: string
  readonly method?: "GET" | "POST" | "PATCH" | "DELETE"
  readonly url?: string
  readonly opens?: string
  readonly params?: Readonly<Record<string, UiActionParam>>
  readonly result?: string
  readonly clear?: readonly string[]
  readonly refresh?: readonly string[]
  readonly confirm?: ConfirmSpec
}

export interface ConfirmSpec {
  readonly say: string
  readonly press: string
}
