import { Context, Effect, Layer, Schema } from "effect"
import YAML from "yaml"
import { Agent } from "./agent.js"
import { AgentContext, Until, type AgentProgram, type Driver } from "./core.js"
import { Connections, type ConnectionRuntime } from "@effect-agent/core"

export type OutputSpec =
  | { readonly kind: "stop" }
  | { readonly kind: "text" }
  | { readonly kind: "thinking" }
  | { readonly kind: "toolCall" }
  | { readonly kind: "schema"; readonly schema: JsonSchema }

export interface JsonSchema {
  readonly type: "string" | "number" | "integer" | "boolean" | "object" | "array"
  readonly properties?: Readonly<Record<string, JsonSchema>>
  readonly required?: ReadonlyArray<string>
  readonly items?: JsonSchema
}

export interface BehaviorSpec {
  readonly id: string
  readonly output: OutputSpec
  readonly behavior: string
  readonly connections?: ReadonlyArray<string>
  readonly resources?: ReadonlyArray<{ readonly ref: string; readonly access: "read" | "write" }>
  readonly metadata?: Readonly<Record<string, unknown>>
}

export interface BehaviorEnvironment {
  readonly connections: ConnectionRuntime
}

export interface BehaviorExtension {
  readonly ref: string
  readonly create: (spec: BehaviorSpec, env: BehaviorEnvironment) => Effect.Effect<Driver, Error>
}

export class BehaviorRegistry {
  constructor(readonly extensions: ReadonlyMap<string, BehaviorExtension>) {}
  static make(extensions: ReadonlyArray<BehaviorExtension> = []) {
    return new BehaviorRegistry(new Map(extensions.map((extension) => [extension.ref, extension])))
  }
  register(extension: BehaviorExtension) {
    const next = new Map(this.extensions)
    next.set(extension.ref, extension)
    return new BehaviorRegistry(next)
  }
  unregister(ref: string) {
    const next = new Map(this.extensions)
    next.delete(ref)
    return new BehaviorRegistry(next)
  }
  resolve(ref: string) {
    const extension = this.extensions.get(ref)
    return extension
      ? Effect.succeed(extension)
      : Effect.fail(new Error(`Behavior extension not registered: ${ref}`))
  }
}

export class Behaviors extends Context.Tag("effect-agent/Behaviors")<Behaviors, BehaviorRegistry>() {
  static layer(extensions: ReadonlyArray<BehaviorExtension> = []) {
    return Layer.succeed(this, BehaviorRegistry.make(extensions))
  }
}

const schemaOf = (json: JsonSchema): Schema.Schema<any> => {
  switch (json.type) {
    case "string": return Schema.String
    case "number": return Schema.Number
    case "integer": return Schema.Int
    case "boolean": return Schema.Boolean
    case "array": return Schema.Array(schemaOf(json.items ?? { type: "string" }))
    case "object": {
      const required = new Set(json.required ?? [])
      const fields = Object.fromEntries(Object.entries(json.properties ?? {}).map(([key, value]) => {
        const field = schemaOf(value)
        return [key, required.has(key) ? field : Schema.optional(field)]
      }))
      return Schema.Struct(fields)
    }
  }
}

// Under run-to-completion (observational) semantics Until.text and Until.stop
// alias: both return the final text and text never pauses (DRAFT 12.1; the
// negotiation matrix in test/capability-matrix.test.ts pins this). Until.text is
// a hint that the caller only needs text, not a pause-at-hit request.
const untilOf = (output: OutputSpec) => {
  switch (output.kind) {
    case "stop": return Until.stop
    case "text": return Until.text
    case "thinking": return Until.thinking
    case "toolCall": return Until.toolCall
    case "schema": return Until.schema(schemaOf(output.schema))
  }
}

export interface CompileEnvironment extends BehaviorEnvironment {
  readonly behaviors: BehaviorRegistry
}

/** Compile a declarative BehaviorSpec. The spec never contains executable functions. */
export const compileBehavior = (spec: BehaviorSpec, environment: CompileEnvironment): Effect.Effect<AgentProgram<any, any>, Error> =>
  Effect.gen(function* () {
    // resources access is not wired: fail early instead of silently ignoring
    // a declared resource dependency (ResourceRef/Resolver are planned).
    if ((spec.resources ?? []).length > 0)
      return yield* Effect.fail(new Error(
        "BehaviorSpec.resources is declared but resource access is not wired yet "
        + "(planned with ResourceRef/Resolver): remove the resources field or declare "
        + "the dependency via connections instead"
      ))
    const connectionState = yield* environment.connections.snapshot()
    for (const ref of spec.connections ?? []) {
      if (!connectionState.specs.has(ref))
        return yield* Effect.fail(new Error(`Connection not registered: ${ref}`))
    }
    const behavior = yield* environment.behaviors.resolve(spec.behavior)
    const driver = yield* behavior.create(spec, environment)
    const builder = Agent.define<any>(spec.id, (input) => AgentContext.text(typeof input === "string" ? input : JSON.stringify(input)))
      .returns(untilOf(spec.output))
    return builder.implementedBy(driver)
  })

/** Layer-driven compiler entry point; declarations remain independent of services. */
export const compileBehaviorProvided = (spec: BehaviorSpec) => Effect.gen(function* () {
  const connections = yield* Connections
  const behaviors = yield* Behaviors
  return yield* compileBehavior(spec, { connections, behaviors })
})

export const parseBehaviorSpec = (format: "json" | "yaml" | "toml", source: string): BehaviorSpec => {
  const value = format === "json"
    ? JSON.parse(source)
    : format === "yaml"
      ? YAML.parse(source)
      : Bun.TOML.parse(source)
  if (!value || typeof value !== "object" || typeof value.id !== "string" || typeof value.behavior !== "string" || !value.output)
    throw new Error("Agent description requires id, behavior and output")
  return value as BehaviorSpec
}
