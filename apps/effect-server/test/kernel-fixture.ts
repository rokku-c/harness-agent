/**
 * A kernel artifact, as a test fixture sees it.
 *
 * The test writes this to a temp directory and stages that directory as a kernel
 * revision, so what is exercised is the real path: `import()` of an entry module
 * from the artifact repo, `createKernel(context)`, the coverage probe, the flip,
 * and the drain-then-stop of the displaced kernel.
 *
 * The fixture reports back through globals because it runs in the same process as
 * the test — this is observation, not simulation. It answers `/-/config` with its
 * own marker, which is how a test tells *which* kernel served a request.
 */

const LOG = "__effectKernelLog"
const GATE = "__effectKernelGate"

export const fixtureKernelSource = (marker: string, holds = false): string => `
const log = (entry) => (globalThis.${LOG} ??= []).push(entry)

export const createKernel = (context) => {
  const kernelId = context.revision === undefined ? "anonymous" : context.revision.kernelId
  const planes = new Map()
  const serve = async (id) => {
    ${holds
      ? `const gate = globalThis.${GATE} ??= {}
    if (gate.promise === undefined) gate.promise = new Promise((resolve) => { gate.open = resolve })
    await gate.promise`
      : ""}
    return Response.json({ kernel: kernelId, marker: ${JSON.stringify(marker)}, plane: id })
  }
  for (const id of ["platform-network", "config"]) {
    planes.set(id, {
      canHandle: (path) => id === "config" && (path === "/-/config" || path.startsWith("/-/config/")),
      handle: () => serve(id),
    })
  }
  log("load:" + ${JSON.stringify(marker)})
  return {
    id: kernelId + "#" + ${JSON.stringify(marker)},
    planes,
    start: async (id) => { if (!planes.has(id)) throw new Error("fixture has no plane " + id) },
    stop: async () => {},
    health: async () => {},
    dispose: async () => { log("dispose:" + ${JSON.stringify(marker)}) },
  }
}
`

/** A kernel that leaves a slot unfilled — the host's coverage probe must catch it. */
export const incompleteKernelSource = `
export const createKernel = () => {
  const planes = new Map([["config", { canHandle: () => false, handle: async () => new Response("x") }]])
  return { id: "incomplete", planes, start: async () => {}, stop: async () => {},
    health: async () => {}, dispose: async () => {} }
}
`

export const fixtureLog = (): readonly string[] =>
  (globalThis as Record<string, unknown>)[LOG] as string[] ?? []

export const clearFixtureLog = (): void => { (globalThis as Record<string, unknown>)[LOG] = [] }

/** Release a held request in a fixture built with `holds`. */
export const openFixtureGate = (): void => {
  const gate = (globalThis as Record<string, unknown>)[GATE] as { open?: () => void } | undefined
  gate?.open?.()
}

export const resetFixtureGate = (): void => { (globalThis as Record<string, unknown>)[GATE] = {} }
