import { Client, type ClientOptions } from "@modelcontextprotocol/sdk/client/index.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { Effect } from "effect"
import type {
  AdapterRef,
  CapabilitySpec,
  ConnectionAdapter,
  ConnectionSession,
  ConnectionSpec,
  JsonSchema,
  JsonValue
} from "@effect-agent/core"

export const McpCapabilities = {
  ping: "ping",
  toolsList: "tools/list",
  toolsCall: "tools/call",
  promptsList: "prompts/list",
  promptsGet: "prompts/get",
  resourcesList: "resources/list",
  resourcesRead: "resources/read",
  resourceTemplatesList: "resources/templates/list",
  resourcesSubscribe: "resources/subscribe",
  resourcesUnsubscribe: "resources/unsubscribe",
  completionComplete: "completion/complete",
  loggingSetLevel: "logging/setLevel"
} as const

export type McpCapability = typeof McpCapabilities[keyof typeof McpCapabilities]

const allCapabilities = new Set<string>(Object.values(McpCapabilities))

const record = (input: unknown): Record<string, unknown> =>
  input !== null && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {}

const promiseEffect = <A>(run: () => Promise<A>): Effect.Effect<A, Error> =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => cause instanceof Error ? cause : new Error(String(cause))
  })

const invokeClient = (client: Client, capability: string, input: unknown): Effect.Effect<unknown, Error> => {
  const params = record(input)
  switch (capability) {
    case McpCapabilities.ping:
      return promiseEffect(() => client.ping())
    case McpCapabilities.toolsList:
      return promiseEffect(() => client.listTools(params as Parameters<Client["listTools"]>[0]))
    case McpCapabilities.toolsCall:
      return promiseEffect(() => client.callTool(params as Parameters<Client["callTool"]>[0]))
    case McpCapabilities.promptsList:
      return promiseEffect(() => client.listPrompts(params as Parameters<Client["listPrompts"]>[0]))
    case McpCapabilities.promptsGet:
      return promiseEffect(() => client.getPrompt(params as Parameters<Client["getPrompt"]>[0]))
    case McpCapabilities.resourcesList:
      return promiseEffect(() => client.listResources(params as Parameters<Client["listResources"]>[0]))
    case McpCapabilities.resourcesRead:
      return promiseEffect(() => client.readResource(params as Parameters<Client["readResource"]>[0]))
    case McpCapabilities.resourceTemplatesList:
      return promiseEffect(() => client.listResourceTemplates(params as Parameters<Client["listResourceTemplates"]>[0]))
    case McpCapabilities.resourcesSubscribe:
      return promiseEffect(() => client.subscribeResource(params as Parameters<Client["subscribeResource"]>[0]))
    case McpCapabilities.resourcesUnsubscribe:
      return promiseEffect(() => client.unsubscribeResource(params as Parameters<Client["unsubscribeResource"]>[0]))
    case McpCapabilities.completionComplete:
      return promiseEffect(() => client.complete(params as Parameters<Client["complete"]>[0]))
    case McpCapabilities.loggingSetLevel:
      return typeof params.level === "string"
        ? promiseEffect(() => client.setLoggingLevel(params.level as Parameters<Client["setLoggingLevel"]>[0]))
        : Effect.fail(new Error("logging/setLevel requires a string level"))
    default:
      return Effect.fail(new Error(`Unsupported MCP capability: ${capability}`))
  }
}

const negotiatedCapabilities = (client: Client): ReadonlySet<string> => {
  const server = client.getServerCapabilities()
  const capabilities = new Set<string>([McpCapabilities.ping])
  if (server?.tools) {
    capabilities.add(McpCapabilities.toolsList)
    capabilities.add(McpCapabilities.toolsCall)
  }
  if (server?.prompts) {
    capabilities.add(McpCapabilities.promptsList)
    capabilities.add(McpCapabilities.promptsGet)
  }
  if (server?.resources) {
    capabilities.add(McpCapabilities.resourcesList)
    capabilities.add(McpCapabilities.resourcesRead)
    capabilities.add(McpCapabilities.resourceTemplatesList)
    if (server.resources.subscribe) {
      capabilities.add(McpCapabilities.resourcesSubscribe)
      capabilities.add(McpCapabilities.resourcesUnsubscribe)
    }
  }
  if (server?.completions) capabilities.add(McpCapabilities.completionComplete)
  if (server?.logging) capabilities.add(McpCapabilities.loggingSetLevel)
  return capabilities
}

export interface McpSdkAdapterOptions {
  readonly kind: string
  readonly createTransport: (config: JsonValue | undefined) => Effect.Effect<Transport, Error>
  readonly clientInfo?: { readonly name: string; readonly version: string }
  readonly clientOptions?: ClientOptions
  /** Register roots, sampling, elicitation, or custom handlers before initialize. */
  readonly configureClient?: (client: Client) => void
}

/**
 * Official MCP SDK client behind the generic ConnectionAdapter boundary.
 * Transport construction stays injectable, so one ConnectionSpec can fail over
 * between Streamable HTTP, stdio, in-memory, or application-defined transports.
 */
export const mcpSdkAdapter = (options: McpSdkAdapterOptions): ConnectionAdapter => ({
  kind: options.kind,
  capabilities: allCapabilities,
  connect: (spec, ref) => Effect.gen(function* () {
    const transport = yield* options.createTransport(ref.config)
    const client = new Client(
      options.clientInfo ?? { name: "effect-agent", version: "0.0.0" },
      { enforceStrictCapabilities: true, ...options.clientOptions }
    )
    if (options.configureClient) {
      yield* Effect.try({
        try: () => options.configureClient!(client),
        catch: (cause) => cause instanceof Error ? cause : new Error(String(cause))
      })
    }
    yield* promiseEffect(() => client.connect(transport))
    const capabilities = negotiatedCapabilities(client)
    const required = new Set([
      ...spec.contract.capabilities.map((capability) => capability.name),
      ...(spec.selection?.strategy === "capability" ? spec.selection.requires : [])
    ])
    const missing = [...required].filter((capability) => !capabilities.has(capability))
    if (missing.length > 0) {
      yield* promiseEffect(() => client.close())
      return yield* Effect.fail(new Error(`MCP server does not advertise required capabilities: ${missing.join(", ")}`))
    }
    return {
      connectionId: spec.id,
      adapter: options.kind,
      capabilities,
      invoke: (capability, input) => invokeClient(client, capability, input),
      close: promiseEffect(() => client.close())
    } satisfies ConnectionSession
  })
})

const objectInput: JsonSchema = { type: "object", additionalProperties: true }

const capabilitySpecs: Readonly<Record<McpCapability, CapabilitySpec>> = {
  [McpCapabilities.ping]: { name: McpCapabilities.ping, input: objectInput, output: objectInput, mode: "read" },
  [McpCapabilities.toolsList]: { name: McpCapabilities.toolsList, input: objectInput, output: objectInput, mode: "read" },
  [McpCapabilities.toolsCall]: { name: McpCapabilities.toolsCall, input: objectInput, output: objectInput, mode: "control" },
  [McpCapabilities.promptsList]: { name: McpCapabilities.promptsList, input: objectInput, output: objectInput, mode: "read" },
  [McpCapabilities.promptsGet]: { name: McpCapabilities.promptsGet, input: objectInput, output: objectInput, mode: "read" },
  [McpCapabilities.resourcesList]: { name: McpCapabilities.resourcesList, input: objectInput, output: objectInput, mode: "read" },
  [McpCapabilities.resourcesRead]: { name: McpCapabilities.resourcesRead, input: objectInput, output: objectInput, mode: "read" },
  [McpCapabilities.resourceTemplatesList]: { name: McpCapabilities.resourceTemplatesList, input: objectInput, output: objectInput, mode: "read" },
  [McpCapabilities.resourcesSubscribe]: { name: McpCapabilities.resourcesSubscribe, input: objectInput, output: objectInput, mode: "control" },
  [McpCapabilities.resourcesUnsubscribe]: { name: McpCapabilities.resourcesUnsubscribe, input: objectInput, output: objectInput, mode: "control" },
  [McpCapabilities.completionComplete]: { name: McpCapabilities.completionComplete, input: objectInput, output: objectInput, mode: "read" },
  [McpCapabilities.loggingSetLevel]: { name: McpCapabilities.loggingSetLevel, input: objectInput, output: objectInput, mode: "control" }
}

export const mcpConnectionSpec = (options: {
  readonly id: string
  readonly adapters: ReadonlyArray<AdapterRef>
  readonly capabilities?: ReadonlyArray<McpCapability>
}): ConnectionSpec => ({
  id: options.id,
  contract: {
    protocol: "mcp",
    capabilities: (options.capabilities ?? [McpCapabilities.toolsList, McpCapabilities.toolsCall])
      .map((capability) => capabilitySpecs[capability])
  },
  adapters: options.adapters,
  selection: { strategy: "failover" }
})
