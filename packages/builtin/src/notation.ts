import { Effect } from "effect"
import type { AdapterRef, CapabilitySpec, ConnectionAdapter, ConnectionSpec, JsonSchema } from "@effect-agent/core"

export const NotationCapabilities = {
  get: "notation/get",
  upsert: "notation/upsert",
  patch: "notation/patch",
  diff: "notation/diff",
  history: "notation/history"
} as const
export type NotationCapability = typeof NotationCapabilities[keyof typeof NotationCapabilities]

export interface NotationEntry {
  readonly target: string
  readonly description?: string
  readonly instructions?: ReadonlyArray<string>
  readonly help?: ReadonlyArray<string>
  readonly metadata?: Readonly<Record<string, unknown>>
}
export interface NotationVersion extends NotationEntry {
  readonly version: number
  readonly changedAt: string
}
export interface NotationStore {
  readonly get: (target: string) => NotationVersion | undefined
  readonly history: (target: string) => ReadonlyArray<NotationVersion>
  readonly upsert: (entry: NotationEntry) => NotationVersion
}

/** Apply external notation without changing the underlying connection behavior. */
export const annotateConnectionSpec = (spec: ConnectionSpec, store: NotationStore): ConnectionSpec => ({
  ...spec,
  contract: {
    ...spec.contract,
    capabilities: spec.contract.capabilities.map((capability) => {
      const note = store.get(`${spec.id}:${capability.name}`) ?? store.get(capability.name)
      return note?.description ? { ...capability, description: note.description } : capability
    })
  }
})

export const notationInstructions = (store: NotationStore, target: string) => store.get(target)?.instructions ?? []
export const notationHelp = (store: NotationStore, target: string) => store.get(target)?.help ?? []

export const memoryNotationStore = (initial: ReadonlyArray<NotationEntry> = []): NotationStore => {
  const records = new Map<string, NotationVersion[]>()
  for (const entry of initial) records.set(entry.target, [{ ...entry, version: 1, changedAt: new Date().toISOString() }])
  return {
    get: (target) => records.get(target)?.at(-1),
    history: (target) => records.get(target) ?? [],
    upsert: (entry) => {
      const versions = records.get(entry.target) ?? []
      const next = { ...entry, version: (versions.at(-1)?.version ?? 0) + 1, changedAt: new Date().toISOString() }
      records.set(entry.target, [...versions, next])
      return next
    }
  }
}

const objectSchema: JsonSchema = { type: "object", additionalProperties: true }
const stringRequired = (name: string): JsonSchema => ({ type: "object", properties: { target: { type: "string" } }, required: ["target"], additionalProperties: true })
const specs: Readonly<Record<NotationCapability, CapabilitySpec>> = {
  [NotationCapabilities.get]: { name: NotationCapabilities.get, input: stringRequired("target"), output: objectSchema, mode: "read" },
  [NotationCapabilities.upsert]: { name: NotationCapabilities.upsert, input: objectSchema, output: objectSchema, mode: "write" },
  [NotationCapabilities.patch]: { name: NotationCapabilities.patch, input: objectSchema, output: objectSchema, mode: "write" },
  [NotationCapabilities.diff]: { name: NotationCapabilities.diff, input: objectSchema, output: objectSchema, mode: "read" },
  [NotationCapabilities.history]: { name: NotationCapabilities.history, input: stringRequired("target"), output: objectSchema, mode: "read" }
}
const targetOf = (input: Record<string, unknown>) => typeof input.target === "string" && input.target.length > 0 ? input.target : undefined
const entryOf = (input: Record<string, unknown>, base: NotationEntry = { target: String(input.target) }): NotationEntry => ({
  ...base,
  target: String(input.target),
  ...(typeof input.description === "string" ? { description: input.description } : {}),
  ...(Array.isArray(input.instructions) ? { instructions: input.instructions.filter((x): x is string => typeof x === "string") } : {}),
  ...(Array.isArray(input.help) ? { help: input.help.filter((x): x is string => typeof x === "string") } : {}),
  ...(input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? { metadata: input.metadata as Record<string, unknown> } : {})
})
const diff = (before: NotationVersion | undefined, after: NotationVersion | undefined) => ({
  target: after?.target ?? before?.target,
  changed: ["description", "instructions", "help", "metadata"].filter((key) => JSON.stringify(before?.[key as keyof NotationEntry]) !== JSON.stringify(after?.[key as keyof NotationEntry])),
  before,
  after
})

/** Inversion-of-control notation registry. Any connection can read or mutate its annotations. */
export const notationAdapter = (options: { readonly kind?: string; readonly store?: NotationStore } = {}): ConnectionAdapter => {
  const kind = options.kind ?? "builtin.notation"
  const store = options.store ?? memoryNotationStore()
  return {
    kind,
    capabilities: new Set(Object.values(NotationCapabilities)),
    connect: (spec) => Effect.succeed({
      connectionId: spec.id,
      adapter: kind,
      capabilities: new Set(Object.values(NotationCapabilities)),
      invoke: (capability, raw) => Effect.try({
        try: () => {
          const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
          const target = targetOf(input)
          if (!target) throw new Error("notation operation requires target")
          switch (capability) {
            case NotationCapabilities.get: return store.get(target)
            case NotationCapabilities.history: return store.history(target)
            case NotationCapabilities.upsert: return store.upsert(entryOf(input))
            case NotationCapabilities.patch: {
              const before = store.get(target)
              return store.upsert(entryOf(input, before ?? { target }))
            }
            case NotationCapabilities.diff: {
              const history = store.history(target)
              const from = typeof input.from === "number" ? history.find((item) => item.version === input.from) : history.at(-2)
              const to = typeof input.to === "number" ? history.find((item) => item.version === input.to) : history.at(-1)
              return diff(from, to)
            }
            default: throw new Error(`Unsupported notation capability: ${capability}`)
          }
        },
        catch: (cause) => cause instanceof Error ? cause : new Error(String(cause))
      }),
      close: Effect.void
    })
  }
}

export const notationConnectionSpec = (options: { readonly id: string; readonly adapters: ReadonlyArray<AdapterRef>; readonly capabilities?: ReadonlyArray<NotationCapability> }): ConnectionSpec => ({
  id: options.id,
  contract: { protocol: "effect-agent.notation/v1", capabilities: (options.capabilities ?? Object.values(NotationCapabilities)).map((name) => specs[name]) },
  adapters: options.adapters,
  selection: { strategy: "failover" }
})
