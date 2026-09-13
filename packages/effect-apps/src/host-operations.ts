/**
 * The host's privileged plane projected into node operations: one entry per
 * declared host operation, addressed under the `host` node, with the arguments
 * read off the declaration's own input schema — a host operation never takes
 * anything the declaration did not name.
 */
import {
  HOST_OPERATIONS,
  runHostOperation,
  type HostOperation,
  type HostOperationTarget,
} from "@effect-agent/effect-host"
import { HOST_NODE, operationAddress, type NodeOperation } from "./operations.ts"

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

export const hostOperations = (host: HostOperationTarget): readonly NodeOperation[] =>
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
