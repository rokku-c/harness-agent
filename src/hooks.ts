import { Effect } from "effect"
import { AgentFailure, type AgentError, type Context, type Detail, type Driver, type DriverEvent } from "./core.js"

export type HarnessEvent =
  | { readonly _tag: "RunStarted"; readonly agent: string; readonly context: Context }
  | DriverEvent
  | { readonly _tag: "ToolStarted"; readonly agent: string; readonly callId: string; readonly tool: string; readonly input: unknown }
  | { readonly _tag: "ToolCompleted"; readonly agent: string; readonly callId: string; readonly tool: string; readonly output: unknown }
  | { readonly _tag: "Detail"; readonly agent: string; readonly detail: Detail }
  | { readonly _tag: "Output"; readonly agent: string; readonly output: unknown }
  | { readonly _tag: "RunFailed"; readonly agent: string; readonly error: AgentError }
  | { readonly _tag: "RunCompleted"; readonly agent: string }

export interface HarnessHook<E = never, R = never> {
  readonly name: string
  readonly handle: (event: HarnessEvent) => Effect.Effect<void, E, R>
}

const emit = <E, R>(hooks: ReadonlyArray<HarnessHook<E, R>>, event: HarnessEvent) =>
  Effect.forEach(hooks, (hook) => hook.handle(event).pipe(
    Effect.mapError((cause) => new AgentFailure({
      agent: `hook:${hook.name}`,
      cause,
      message: `HarnessHook ${hook.name} failed on ${event._tag}`
    }))
  ), { discard: true })

const instrument = <E, RH>(
  driver: Driver<any>,
  context: Context,
  hooks: ReadonlyArray<HarnessHook<E, RH>>
): Context => {
  const access = context.access.map(({ binding, write }) => ({
    write,
    binding: {
      ...binding,
      ops: binding.ops?.map((op) => ({
        ...op,
        execute: (input: unknown) => {
          const callId = crypto.randomUUID()
          return emit(hooks, {
            _tag: "ToolStarted", agent: driver.id, callId, tool: op.name, input
          }).pipe(
            Effect.flatMap(() => op.execute(input)),
            Effect.tap((output) => emit(hooks, {
              _tag: "ToolCompleted", agent: driver.id, callId, tool: op.name, output
            }))
          )
        }
      }))
    }
  }))
  return context.withAccess(access)
}

export const Harness = {
  hook: <E = never, R = never>(name: string, handle: HarnessHook<E, R>["handle"]): HarnessHook<E, R> => ({ name, handle }),

  withHooks: <E = never, RH = never, RD = never>(
    driver: Driver<RD>,
    ...hooks: ReadonlyArray<HarnessHook<E, RH>>
  ): Driver<RD | RH> => ({
    ...driver,
    start: (request) => emit(hooks, {
      _tag: "RunStarted", agent: driver.id, context: request.context
    }).pipe(
      Effect.flatMap(() => driver.start({
        context: instrument(driver, request.context, hooks),
        report: ((event: DriverEvent) => Effect.all([
          request.report?.(event) ?? Effect.void,
          emit(hooks, event)
        ], { discard: true })) as (event: DriverEvent) => Effect.Effect<void, AgentError, never>
      })),
      Effect.map((driverSession) => ({
        step: driverSession.step.pipe(
          Effect.tap((event) => event._tag === "Detail"
            ? emit(hooks, { _tag: "Detail", agent: driver.id, detail: event.detail })
            : Effect.all([
                emit(hooks, { _tag: "Output", agent: driver.id, output: event.value }),
                emit(hooks, { _tag: "RunCompleted", agent: driver.id })
              ], { discard: true }))
        )
      }) as import("./core.js").DriverSession<RH>),
      Effect.tapError((error) => emit(hooks, { _tag: "RunFailed", agent: driver.id, error }).pipe(Effect.ignore))
    ) as any
  })
}

export const ConsoleHook = Harness.hook("console", (event) => Effect.sync(() => {
  switch (event._tag) {
    case "ToolStarted": console.log(`[${event.agent}] tool → ${event.tool}`); break
    case "ToolCompleted": console.log(`[${event.agent}] tool ✓ ${event.tool}`); break
    case "RunFailed": console.error(`[${event.agent}] failed`, event.error); break
    case "RunCompleted": console.log(`[${event.agent}] completed`); break
  }
}))
