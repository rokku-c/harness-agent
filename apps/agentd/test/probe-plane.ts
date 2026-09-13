/**
 * Shared scaffolding for the probe acceptance tests: the control plane's config,
 * and the few reads a test needs to see what the control plane believes.
 */

export const TOKEN = "fleet-secret"

export const DECLARED = {
  machineId: "m1", name: "workshop-1", status: "online" as const,
  capabilities: ["abi:effect-1", "runtime:os"],
  namespaces: ["ops"],
}

export const config = (leaseTtlMs: number) => ({
  leaseTtlMs, nodeToken: TOKEN,
  machines: [{ machineId: "m1", name: "workshop-1", capabilities: ["abi:effect-1", "runtime:os"], namespaces: ["ops"] }],
  bundles: [{ bundleId: "board", version: "1.0.0", abi: "effect-1" }],
  nodeBindings: [{ nodeId: "m1", apps: [{ bundleId: "board", version: "1.0.0", ns: "ops" }] }],
})

export interface Presence { readonly online: boolean; readonly withdrawn: boolean; readonly lastSeen?: number }
export interface Receipt {
  readonly revision: number
  readonly state: { ok?: boolean; error?: string; deployment?: { apps: ReadonlyArray<{ ns: string; bundleId: string; version: string }> } }
  /** When the server recorded it — the one thing that says whether it was re-sent. */
  readonly at: number
}
interface Machine extends Record<string, unknown> {
  /** The revision the node was told to run, and the receipt it sent back, on the record they belong to. */
  readonly desired: unknown
  readonly applied: Receipt | null
}
interface Status {
  readonly machines: readonly Machine[]
}

const read = async <T>(base: string, path: string): Promise<T> =>
  await (await fetch(new URL(path, base), { headers: { authorization: `Bearer ${TOKEN}` } })).json() as T
export const presence = async (base: string): Promise<Presence> =>
  (await read<{ presence: Presence }>(base, "/agentd/node/presence?nodeId=m1")).presence
export const machine = async (base: string): Promise<Machine> => (await read<Status>(base, "/agentd")).machines[0]!
export const receipts = async (base: string): Promise<readonly Receipt[]> =>
  (await read<Status>(base, "/agentd")).machines.flatMap((held) => held.applied === null ? [] : [held.applied])
export const desired = async (base: string): Promise<unknown> => (await read<Status>(base, "/agentd")).machines[0]?.desired

export const until = async <T>(poll: () => Promise<T | undefined>, timeoutMs = 5000): Promise<T> => {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await poll().catch(() => undefined)
    if (value !== undefined) return value
    if (Date.now() > deadline) throw new Error("timed out waiting for the control plane")
    await Bun.sleep(20)
  }
}
