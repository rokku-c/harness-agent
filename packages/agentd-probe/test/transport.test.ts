import { expect, test } from "bun:test"
import { makeNodeControl, ProbeFault, type FetchLike, type NodeControl } from "../src/index.ts"
import { machine } from "./harness.ts"

const invoke = (control: NodeControl, verb: string): Promise<unknown> =>
  verb === "announce" ? control.announce(machine)
  : verb === "heartbeat" ? control.heartbeat("m1")
  : verb === "withdraw" ? control.withdraw("m1")
  : verb === "plan" ? control.plan("m1")
  : control.report("m1", 7, {})

const faultOf = async (status: number, verb: string): Promise<ProbeFault> => {
  const fetch: FetchLike = async () => new Response(JSON.stringify({ ok: false, error: "nope" }), { status })
  return await invoke(makeNodeControl({ baseUrl: "http://control", fetch }), verb)
    .then(() => { throw new Error(`expected ${verb} to fault`) }, (error: unknown) => error as ProbeFault)
}

test("no response at all is `unreachable`, and that is not one of the answers", async () => {
  const control = makeNodeControl({
    baseUrl: "http://control",
    fetch: async () => { throw new Error("ECONNREFUSED 127.0.0.1:8080") },
  })
  const fault = await control.heartbeat("m1")
    .then(() => { throw new Error("expected a fault") }, (error: unknown) => error as ProbeFault)
  expect(fault).toBeInstanceOf(ProbeFault)
  expect(fault.kind).toBe("unreachable")
  // Nothing answered, so there is no status to report and no answer to mistake for consent.
  expect(fault.status).toBeUndefined()
  expect(fault.message).toContain("ECONNREFUSED")
})

test("each status is read as the answer it is, per verb", async () => {
  const cases: ReadonlyArray<[number, string, string]> = [
    [401, "announce", "refused"],
    [400, "announce", "refused"],
    [403, "plan", "refused"],
    [404, "heartbeat", "lapsed"],
    [409, "report", "stale"],
    [500, "plan", "unavailable"],
    // A 400 on the plan is the plan builder refusing *the deployment*, not us.
    [400, "plan", "plan"],
  ]
  for (const [status, verb, kind] of cases) {
    const fault = await faultOf(status, verb)
    expect([status, verb, fault.kind, fault.status]).toEqual([status, verb, kind, status])
    // The control plane's own words survive: "plan refused" is not actionable, and
    // "cannot place ops::board@1.0.0 on m1: no os runtime" is.
    expect(fault.message).toContain("nope")
  }
})

test("the node credential travels in `authorization`, and the node id is URL-encoded", async () => {
  const seen: Array<{ url: string; init: RequestInit | undefined }> = []
  const fetch: FetchLike = async (url, init) => {
    seen.push({ url, init })
    return new Response(JSON.stringify({
      ok: true, presence: { nodeId: "m1", online: true, withdrawn: false },
      nodeId: "m1", revision: 3, changes: [], desired: {},
    }), { status: 200 })
  }
  const control = makeNodeControl({ baseUrl: "http://control", token: "s3cret", fetch })
  expect((await control.heartbeat("m1")).withdrawn).toBe(false)
  expect(seen[0]!.url).toBe("http://control/agentd/node/heartbeat")
  expect(new Headers(seen[0]!.init?.headers).get("authorization")).toBe("Bearer s3cret")
  expect(JSON.parse(String(seen[0]!.init?.body))).toEqual({ nodeId: "m1" })

  expect((await control.plan("m 1/x")).revision).toBe(3)
  expect(seen[1]!.url).toBe("http://control/agentd/node/plan?nodeId=m%201%2Fx")
})

test("without a credential nothing is sent, not an empty one", async () => {
  let headers: Headers | undefined
  const control = makeNodeControl({
    baseUrl: "http://control",
    fetch: async (_url, init) => {
      headers = new Headers(init?.headers)
      return new Response(JSON.stringify({ ok: true, presence: { nodeId: "m1", online: true, withdrawn: false } }), { status: 200 })
    },
  })
  await control.heartbeat("m1")
  expect(headers?.has("authorization")).toBe(false)
})

test("a 200 that says `ok: false` is not success", async () => {
  const control = makeNodeControl({
    baseUrl: "http://control",
    fetch: async () => new Response(JSON.stringify({ ok: false, error: "not really" }), { status: 200 }),
  })
  const fault = await control.heartbeat("m1")
    .then(() => { throw new Error("expected a fault") }, (error: unknown) => error as ProbeFault)
  expect(fault.kind).toBe("refused")
  expect(fault.message).toContain("not really")
})
