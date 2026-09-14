import { Context, Effect, Ref } from "effect"
import { Op, notationText } from "@effect-agent/core"
import type { Binding } from "@effect-agent/core"
import type { ToolDescriptor } from "./descriptor.ts"

export interface ToolRegistryService {
  readonly register: (descriptor: ToolDescriptor) => Effect.Effect<void>
  readonly registerMany: (descriptors: ReadonlyArray<ToolDescriptor>) => Effect.Effect<void>
  readonly list: (includeHidden?: boolean) => Effect.Effect<ReadonlyArray<ToolDescriptor>>
  readonly asBinding: (descriptor: ToolDescriptor) => Binding<any, unknown, never>
  readonly asBindings: () => Effect.Effect<ReadonlyArray<Binding<any, unknown, never>>>
}

export class ToolRegistry extends Context.Tag("effect-agent/ToolRegistry")<ToolRegistry, ToolRegistryService>() {}

export const toCoreOp = (descriptor: ToolDescriptor) => {
  const spec = {
    name: descriptor.name,
    description: notationText(descriptor.description),
    input: undefined as never,
    output: undefined as never,
    execute: (input: unknown) =>
      Effect.tryPromise({
        try: () => descriptor.execute(input),
        catch: (cause) => cause as never
      })
  }
  return descriptor.access === "write" ? Op.write(spec as never) : Op.read(spec as never)
}

export const MemoryToolRegistry = Effect.gen(function* () {
  const tools = yield* Ref.make<ReadonlyArray<ToolDescriptor>>([])
  const service: ToolRegistryService = {
    register: (descriptor) =>
      Ref.update(tools, (current) =>
        current.some((existing) => existing.name === descriptor.name)
          ? current.map((existing) => (existing.name === descriptor.name ? descriptor : existing))
          : [...current, descriptor]
      ),
    registerMany: (descriptors) => Ref.update(tools, (current) => [...current, ...descriptors]),
    list: (includeHidden = false) =>
      Effect.map(Ref.get(tools), (all) => all.filter((descriptor) => includeHidden || !descriptor.hidden)),
    asBinding: (descriptor) => ({
      uri: "ea://tools/" + encodeURIComponent(descriptor.name),
      ops: [toCoreOp(descriptor)]
    }),
    asBindings: () =>
      Effect.map(Ref.get(tools), (all) => all.filter((descriptor) => !descriptor.hidden).map((descriptor) => service.asBinding(descriptor)))
  }
  return service
})
