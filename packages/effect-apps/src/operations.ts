/**
 * The node operation table — host and apps in ONE enumeration
 * (docs/architecture-rework.md §4: "host 节点与 app 节点共用同一张表").
 *
 * §4 already had the shape: an operation has a node, a plane, a name, a schema
 * and an invoke. What was missing was the host half — the privileged lifecycle
 * plane existed only as HTTP control routes, so nothing could enumerate it next
 * to the apps it governs. effect-host now *declares* those operations
 * (operations.ts there) and this module projects them into the same table the
 * app tools live in.
 *
 * Two deliberate properties:
 *
 *   - `list()` is a **view**, not a snapshot. It re-reads the catalog on every
 *     call, so a hot-swapped app (§6.4) shows its current surface and nothing
 *     has to be kept in sync. Snapshotting tool surfaces at construction time is
 *     exactly the bug fixed in effect-mcp's ToolSurface.
 *   - Privilege is a property of the entry (`privileged`), not a separate table.
 *     Only the host node has a lifecycle plane; apps never do (§4).
 */

import {
  HOST_OPERATIONS,
  runHostOperation,
  type HostOperation,
  type HostOperationTarget,
} from "@effect-agent/effect-host"
import type { ToolEntry } from "@effect-agent/effect-interface"
import { appKey, type AppEntry } from "./catalog.ts"
import { invokeAppTool, listAppTools } from "./tools.ts"

/** The node id the host's own operations are addressed under. */
export const HOST_NODE = "host"

/** `${node}::${plane}::${name}` — same `::` idiom as `ns::appId`. */
export const operationAddress = (node: string, plane: string, name: string): string =>
  `${node}::${plane}::${name}`

export interface NodeOperation {
  /** "host", or an app's `ns::appId`. */
  readonly node: string
  /** "lifecycle" (host only) or "interface". */
  readonly plane: string
  readonly name: string
  /** Stable address for §4's table: `${node}::${plane}::${name}`. */
  readonly address: string
  readonly description: string
  readonly inputSchema: unknown
  readonly outputSchema?: unknown
  /** Host-only capability — an app node never has one (§4). */
  readonly privileged: boolean
  readonly invoke: (args: unknown) => Promise<unknown>
}

export interface NodeOperationTable {
  /** Every operation of the host and of every app the caller may read. */
  list(): readonly NodeOperation[]
  find(address: string): NodeOperation | undefined
  resolve(address: string): NodeOperation
  invoke(address: string, args: unknown): Promise<unknown>
}

/** JSON-safe projection — the operation without its `invoke` closure. */
export interface NodeOperationSummary {
  readonly node: string
  readonly plane: string
  readonly name: string
  readonly address: string
  readonly description: string
  readonly inputSchema: unknown
  readonly outputSchema?: unknown
  readonly privileged: boolean
}

/**
 * The listing form: schemas and names, no behaviour. A `/-/` surface serves
 * this; acting on an operation stays on the paths declared for it (the host's
 * control plane), so describing and doing are never the same endpoint.
 */
export const nodeOperationSummary = (operation: NodeOperation): NodeOperationSummary => ({
  node: operation.node,
  plane: operation.plane,
  name: operation.name,
  address: operation.address,
  description: operation.description,
  inputSchema: operation.inputSchema,
  ...(operation.outputSchema === undefined ? {} : { outputSchema: operation.outputSchema }),
  privileged: operation.privileged,
})

/** Read declared template parameters off the call arguments, refusing bad ones. */
const paramsFor = (operation: HostOperation, args: unknown): Readonly<Record<string, string>> => {
  const properties = (operation.inputSchema.properties ?? {}) as Readonly<Record<string, unknown>>
  const source = (args ?? {}) as Readonly<Record<string, unknown>>
  const params: Record<string, string> = {}
  for (const name of Object.keys(properties)) {
    const value = source[name]
    if (typeof value !== "string") {
      throw new Error(`effect-apps: host.${operation.name} requires a string "${name}"`)
    }
    params[name] = value
  }
  return params
}

const hostOperations = (host: HostOperationTarget): readonly NodeOperation[] =>
  HOST_OPERATIONS.map((operation) => ({
    node: HOST_NODE,
    plane: operation.plane,
    name: operation.name,
    address: operationAddress(HOST_NODE, operation.plane, operation.name),
    description: operation.description,
    inputSchema: operation.inputSchema,
    outputSchema: operation.outputSchema,
    privileged: true,
    invoke: (args) => runHostOperation(operation, paramsFor(operation, args), host),
  }))

/** One app's interface plane. `listAppTools` already applies the authorize() gate. */
const appOperations = (app: AppEntry): readonly NodeOperation[] => {
  const node = appKey(app.ns, app.appId)
  return listAppTools(app).map((entry: ToolEntry) => {
    const schema = app.registry?.schemaFor(entry.key)
    return {
      node,
      plane: "interface",
      name: entry.tool.name,
      address: operationAddress(node, "interface", entry.tool.name),
      description: schema?.description ?? entry.tool.description ?? "",
      inputSchema: schema?.parameters ?? entry.tool.inputSchema ?? null,
      outputSchema: schema?.output ?? entry.tool.outputSchema,
      privileged: false,
      invoke: (args: unknown) => invokeAppTool(app, entry.tool.name, args),
    }
  })
}

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
