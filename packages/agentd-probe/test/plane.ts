import type { FetchLike } from "../src/index.ts"

export type Verb = "announce" | "heartbeat" | "withdraw" | "plan" | "report"
/** A forced answer for one verb: an HTTP status, or no response at all. */
export type Rule = number | "unreachable"

export interface Plane {
  readonly fetch: FetchLike
  /** Verbs in the order they arrived — how a test sees what the loop did. */
  readonly calls: readonly string[]
  /** Receipt states, untyped on purpose: a state is the node's own payload. */
  readonly receipts: ReadonlyArray<{ revision: number; state: unknown }>
  /** What the control plane says the node should run; a test moves it to see a re-apply. */
  revision: number
}

const reply = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

/**
 * The agentd node surface (§8.5-1 and §8.4), faked at the wire rather than at the
 * client. The probe's own transport is then still under test and the only thing
 * replaced is the machine on the other end — a fake `NodeControl` would have
 * taken the URL building, the headers and the decoding out of the test along
 * with it.
 */
export const fakePlane = (rules: Partial<Record<Verb, Rule>> = {}): Plane => {
  const calls: string[] = [], receipts: Array<{ revision: number; state: unknown }> = []
  const plane: Plane = {
    calls, receipts, revision: 1,
    fetch: async (url, init) => {
      const verb = new URL(url).pathname.replace("/agentd/node/", "").replace("/agentd/node", "desired") as Verb
      calls.push(verb)
      const rule = rules[verb]
      if (rule === "unreachable") throw new Error(`ECONNREFUSED ${verb}`)
      if (typeof rule === "number") return reply(rule, { ok: false, error: `${verb} was refused by the test` })
      const body = (init?.body === undefined ? {} : JSON.parse(String(init.body))) as Record<string, unknown>
      if (verb === "plan") {
        return reply(200, {
          ok: true, nodeId: "m1", revision: plane.revision, changes: ["+ ops::board@1.0.0"],
          desired: { nodeId: "m1", apps: [], metadata: { nodeId: "m1", revision: plane.revision } },
        })
      }
      if (verb === "report") {
        receipts.push({ revision: body.revision as number, state: body.state })
        return reply(200, { ok: true, report: body })
      }
      const announced = (body.machine as { machineId?: string } | undefined)?.machineId
      return reply(200, {
        ok: true,
        presence: { nodeId: body.nodeId ?? announced, online: true, withdrawn: verb === "withdraw" },
      })
    },
  }
  return plane
}
