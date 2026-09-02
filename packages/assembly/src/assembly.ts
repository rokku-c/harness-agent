/**
 * The composition root (cross-cutting Assembly): defaultLayers() turns every seam
 * into a Layer - open-box defaults unless overridden - and driver() reads
 * the Model from the assembled context. This is where the "accumulation" happens:
 * each layer adds one replaceable service, nothing else changes.
 */
import { Effect, Layer } from "effect"
import { EffectAgent } from "@effect-agent/builtin"
import type { Driver } from "@effect-agent/core"
import { echoModel, ModelTag } from "@effect-agent/model"
import { Delivery, Ingress, MemoryChannel } from "@effect-agent/channel"
import { AllowAllGate, Gate } from "@effect-agent/gate"
import { ScopedMemory, Memory } from "@effect-agent/memory"
import { MemoryToolRegistry, ToolRegistry } from "@effect-agent/tools"
import { IntervalScheduler, Scheduler } from "@effect-agent/schedule"
import { EventLog, MemoryEventLog, MemoryStore, Store } from "@effect-agent/state"
import type { AssembleOptions, DriverOptions } from "./options.ts"

export const defaultLayers = (options: AssembleOptions = {}): Layer.Layer<
  ModelTag | Store | EventLog | Memory | Ingress | Delivery | ToolRegistry | Gate | Scheduler
> => {
  const modelLayer = Layer.succeed(ModelTag, options.model ?? echoModel)
  const storeLayer = Layer.effect(Store, options.store === undefined ? MemoryStore : Effect.succeed(options.store))
  const eventLogLayer = Layer.effect(
    EventLog,
    options.eventLog === undefined ? MemoryEventLog : Effect.succeed(options.eventLog)
  )
  const channel = options.channel ?? new MemoryChannel()
  const channelLayer = Layer.merge(
    Layer.succeed(Ingress, channel.ingress),
    Layer.succeed(Delivery, channel.delivery)
  )
  const registryLayer = Layer.effect(
    ToolRegistry,
    options.registry === undefined ? MemoryToolRegistry : Effect.succeed(options.registry)
  )
  const gateLayer = Layer.succeed(Gate, options.gate ?? AllowAllGate)
  const memoryLayer = Layer.effect(
    Memory,
    options.memory === undefined ? ScopedMemory : Effect.succeed(options.memory)
  )
  // Layer.mergeAll does NOT resolve cross-layer requirements - wire explicitly.
  const wiredMemory = memoryLayer.pipe(Layer.provide(storeLayer))
  const schedulerLayer =
    options.scheduler === undefined
      ? Layer.effect(Scheduler, IntervalScheduler)
      : Layer.succeed(Scheduler, options.scheduler)
  return Layer.mergeAll(
    modelLayer,
    storeLayer,
    eventLogLayer,
    wiredMemory,
    channelLayer,
    registryLayer,
    gateLayer,
    schedulerLayer
  ) as Layer.Layer<
    ModelTag | Store | EventLog | Memory | Ingress | Delivery | ToolRegistry | Gate | Scheduler,
    never,
    never
  >
}

/** The default driver: EffectAgent with the Model from the assembled context. */
export const driver = (options: DriverOptions = {}): Effect.Effect<Driver, never, ModelTag> =>
  Effect.map(ModelTag, (model) =>
    EffectAgent.make({ model, instructions: options.instructions, maxSteps: options.maxSteps })
  )

/** Convenience: run an effect with the default layers provided. */
export const assemble = (options: AssembleOptions = {}) => {
  const layers = defaultLayers(options)
  return {
    layers,
    provide: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      Effect.provide(effect, layers) as Effect.Effect<A, E>,
    run: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      Effect.runPromise(Effect.provide(effect, layers) as Effect.Effect<A, E>)
  }
}
