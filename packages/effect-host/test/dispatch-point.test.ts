import { expect, test } from "bun:test"
import { makeDispatchPoint, type DispatchTarget } from "../src/index.ts"

interface TestTarget extends DispatchTarget { readonly answer: string }

const target = (id: string, answer = id): TestTarget => ({
  id,
  answer,
  handle: async () => new Response(answer),
})

/** A target whose response is released by the test, to hold a request open. */
const gated = (id: string) => {
  let open: () => void = () => {}
  const gate = new Promise<void>((resolve) => { open = resolve })
  const t: DispatchTarget = { id, handle: async () => { await gate; return new Response(id) } }
  return { target: t, open }
}

test("a request runs against the target that is current when it starts", async () => {
  const point = makeDispatchPoint<TestTarget>()
  const a = target("a"), b = target("b")

  point.activate(a)
  expect(await (await point.run((t) => t.handle(new Request("http://x/")))).text()).toBe("a")

  point.activate(b)
  expect(await (await point.run((t) => t.handle(new Request("http://x/")))).text()).toBe("b")
})

test("an in-flight request completes on the old target across a flip", async () => {
  const point = makeDispatchPoint<DispatchTarget>()
  const held = gated("a"), b = target("b")
  point.activate(held.target)

  const inFlight = point.run((t) => t.handle(new Request("http://x/")))
  point.activate(b)                    // the flip happens while the request is open
  held.open()

  expect(await (await inFlight).text()).toBe("a")
  expect(point.current()).toBe(b)
})

test("retire waits for the in-flight requests of the displaced target", async () => {
  const point = makeDispatchPoint<DispatchTarget>()
  const held = gated("a")
  point.activate(held.target)

  const inFlight = point.run((t) => t.handle(new Request("http://x/")))
  point.activate(target("b"))

  let retired = false
  const retirement = point.retire(held.target).then(() => { retired = true })
  await Bun.sleep(1)
  expect(retired).toBe(false)          // still serving
  expect(point.inFlight(held.target)).toBe(1)

  held.open()
  await inFlight
  await retirement
  expect(retired).toBe(true)
  expect(point.inFlight(held.target)).toBe(0)
})

test("retire of a target with nothing in flight returns immediately", async () => {
  const point = makeDispatchPoint<TestTarget>()
  const a = target("a")
  point.activate(a)
  point.activate(target("b"))
  await point.retire(a)                // resolves without ever being activated again
})

test("retire refuses the active target: flip first, then stop", async () => {
  const point = makeDispatchPoint<TestTarget>()
  const a = target("a")
  point.activate(a)

  await expect(point.retire(a)).rejects.toThrow(/active target a/)
  expect(point.current()).toBe(a)
})

test("a request that arrives with no active target is refused, not crashed", async () => {
  const point = makeDispatchPoint<TestTarget>()
  const response = await point.run((t) => t.handle(new Request("http://x/")))

  expect(response.status).toBe(503)
  expect(point.current()).toBeUndefined()
})

test("stats name what is serving and what is still draining", async () => {
  const point = makeDispatchPoint<DispatchTarget>()
  const held = gated("a")
  point.activate(held.target)
  const inFlight = point.run((t) => t.handle(new Request("http://x/")))
  point.activate(target("b"))

  expect(point.stats()).toEqual([
    { id: "a", inFlight: 1, active: false },
    { id: "b", inFlight: 0, active: true },
  ])

  held.open()
  await inFlight
})

test("a failure inside a request still releases the in-flight count", async () => {
  const point = makeDispatchPoint<TestTarget>()
  point.activate(target("a"))

  await expect(point.run(async () => { throw new Error("plane exploded") })).rejects.toThrow("plane exploded")
  expect(point.inFlight()).toBe(0)
})
