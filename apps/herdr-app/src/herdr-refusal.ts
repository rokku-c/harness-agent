import { OperationFault } from "@effect-agent/effect-interface"

export interface HerdrError {
  readonly code?: string
  readonly message?: string
}

const missing = (code: string): boolean => code.includes("not_found")

const overloaded = (code: string): boolean => code === "unavailable" || code === "server_unavailable"

const timedOut = (code: string): boolean => code === "timeout" || code.endsWith("_stalled")

const malformed = (code: string): boolean =>
  code.startsWith("invalid") || code.startsWith("empty_") || code.startsWith("unsupported") || code.startsWith("missing_")

const conflicting = (code: string): boolean =>
  code.endsWith("_busy") || code.endsWith("_not_ready") || code.endsWith("_blocked") ||
  code.endsWith("_launch_pending") || code.startsWith("already_") || code === "confirmation_required"

export const statusOf = (code: string | undefined): number => {
  if (code === undefined) return 502
  if (missing(code)) return 404
  if (timedOut(code)) return 504
  if (overloaded(code)) return 503
  if (malformed(code)) return 400
  if (conflicting(code)) return 409
  return 502
}

export const refusalOf = (error: HerdrError): OperationFault =>
  new OperationFault(statusOf(error.code), error.message ?? error.code ?? "herdr refused the request")
