/**
 * The live node operation table: the host's declared operations and every app's
 * interface plane, joined into one `list()`.
 *
 * `list()` is a **view**, not a snapshot. It re-reads the catalog on every call,
 * so a hot-swapped app (§6.4) shows its current surface and nothing has to be
 * kept in sync. Snapshotting a tool surface at construction time is the failure
 * this avoids: the MCP node servers are built per request for the same reason.
 */
import type { HostOperationTarget } from "@effect-agent/effect-host"
import { appOperations } from "./app-operations.ts"
import type { AppEntry } from "./catalog.ts"
import { hostOperations } from "./host-operations.ts"
import type { NodeOperation, NodeOperationTable } from "./operations.ts"

export const makeNodeOperationTable = (
  host: HostOperationTarget,
  apps: readonly AppEntry[],
): NodeOperationTable => {
  const list = (): readonly NodeOperation[] => [
    ...hostOperations(host),
    ...apps.flatMap((app) => appOperations(app)),
  ]

  const find = (address: string): NodeOperation | undefined =>
    list().find((operation) => operation.address === address)

  const resolve = (address: string): NodeOperation => {
    const operation = find(address)
    if (operation === undefined) throw new Error(`effect-apps: no operation ${address}`)
    return operation
  }

  return {
    list,
    find,
    resolve,
    invoke: (address, args) => resolve(address).invoke(args),
  }
}
