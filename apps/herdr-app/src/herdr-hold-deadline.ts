const HOLD_MARGIN_MS = 1_000

export const holdDeadlineMs = (holdMs: number | undefined): number | undefined =>
  holdMs === undefined ? undefined : holdMs + HOLD_MARGIN_MS
