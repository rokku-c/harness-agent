export const HOST_NODE = "host"

export const operationAddress = (node: string, plane: string, name: string): string =>
  `${node}::${plane}::${name}`

export interface NodeOperation {
  readonly node: string
  readonly plane: string
  readonly name: string
  readonly address: string
  readonly description: string
  readonly inputSchema: unknown
  readonly outputSchema?: unknown
  readonly privileged: boolean
  readonly invoke: (args: unknown) => Promise<unknown>
}

export interface NodeOperationTable {
  list(): readonly NodeOperation[]
  find(address: string): NodeOperation | undefined
  resolve(address: string): NodeOperation
  invoke(address: string, args: unknown): Promise<unknown>
}

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
