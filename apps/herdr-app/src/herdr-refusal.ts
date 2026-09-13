/**
 * Herdr's refusals, as this server answers them.
 *
 * Herdr refuses a request with its own code and a sentence, and the code is what
 * says whose mistake it was. Translating that is this plane's one act of
 * judgement: the sentence travels unchanged, because Herdr's own words about a
 * pane that is busy are better than anything restated here, and the status is
 * what a caller branches on.
 *
 * The vocabulary is observed, not published — Herdr ships no exhaustive list of
 * codes, so these are the families gathered from its binary and its own
 * documentation. Anything unrecognised stays a 502: a status guessed wrong tells
 * a caller to fix something that was never wrong, which is worse than one that
 * says plainly it does not know.
 */
import { OperationFault } from "@effect-agent/effect-interface"

export interface HerdrError {
  readonly code?: string
  readonly message?: string
}

/** The thing the request names is not there: a workspace, pane, tab or agent. */
const missing = (code: string): boolean => code.includes("not_found")

/** Herdr is up and cannot serve this now, which is not the caller's mistake. */
const overloaded = (code: string): boolean => code === "unavailable" || code === "server_unavailable"

/**
 * Herdr watched for the thing it was asked to watch for and it never happened —
 * its own deadline, or the prompt that had to move the agent within five seconds
 * and did not. Neither is a fault in Herdr or in the request.
 */
const timedOut = (code: string): boolean => code === "timeout" || code.endsWith("_stalled")

/** The request itself is wrong: a bad field, an empty one, a kind it has no integration for. */
const malformed = (code: string): boolean =>
  code.startsWith("invalid") || code.startsWith("empty_") || code.startsWith("unsupported") || code.startsWith("missing_")

/** Well-formed, and the target is in a state that refuses it — a busy pane, an agent mid-startup. */
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

/** Herdr's error, as the fault this plane throws. */
export const refusalOf = (error: HerdrError): OperationFault =>
  new OperationFault(statusOf(error.code), error.message ?? error.code ?? "herdr refused the request")
