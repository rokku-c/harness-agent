import { issuesOf, messageOf, statusOf, type Failed } from "@effect-agent/effect-interface"

export class Refusal extends Error {
  constructor(readonly status: number, readonly body: Record<string, unknown>) {
    super(typeof body.detail === "string" ? body.detail : "refused")
    this.name = "Refusal"
  }
}

export function refuse(status: number, detail: string): never {
  throw new Refusal(status, { ok: false, detail })
}

export const deckFailure = (error: unknown): Failed => {
  if (error instanceof Refusal) return { status: error.status, body: error.body }
  const issues = issuesOf(error)
  if (issues !== undefined) return { status: 400, body: { ok: false, detail: issues } }
  return { status: statusOf(error), body: { ok: false, detail: messageOf(error) } }
}
