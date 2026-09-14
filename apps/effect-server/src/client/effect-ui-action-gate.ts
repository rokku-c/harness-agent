import type { ConfirmSpec } from "@effect-agent/effect-ui"

export type Ask = (confirm: ConfirmSpec) => Promise<boolean>

export const mayRun = async (confirm: ConfirmSpec | undefined, ask: Ask): Promise<boolean> =>
  confirm === undefined || await ask(confirm)
