import * as React from "react"
import type { ConfirmSpec } from "@effect-agent/effect-ui"

interface Pending {
  readonly confirm: ConfirmSpec
  readonly settle: (yes: boolean) => void
}

let pending: Pending | null = null
const listeners = new Set<() => void>()
const emit = (): void => { for (const listener of listeners) listener() }
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const askConfirm = (confirm: ConfirmSpec): Promise<boolean> =>
  new Promise((settle) => {
    pending?.settle(false)
    pending = { confirm, settle }
    emit()
  })

export const answerConfirm = (yes: boolean): void => {
  const question = pending
  if (question === null) return
  pending = null
  emit()
  question.settle(yes)
}

export const useConfirm = (): ConfirmSpec | null =>
  React.useSyncExternalStore(subscribe, () => pending?.confirm ?? null)
