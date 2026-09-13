/**
 * The node operation table's contract — host and apps in ONE enumeration
 * (docs/architecture-rework.md §4: "host 节点与 app 节点共用同一张表").
 *
 * §4 already had the shape: an operation has a node, a plane, a name, a schema
 * and an invoke. What was missing was the host half — the privileged lifecycle
 * plane existed only as HTTP control routes, so nothing could enumerate it next
 * to the apps it governs. effect-host now *declares* those operations and this
 * package projects them into the same table the app tools live in: the host
 * plane in host-operations.ts, the app planes in app-operations.ts, joined by
 * operations-table.ts.
 *
 * Privilege is a property of the entry (`privileged`), not a separate table.
 * Only the host node has a lifecycle plane; apps never do (§4).
 */

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
