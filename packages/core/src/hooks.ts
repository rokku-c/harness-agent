import { Effect } from "effect"
import type { AgentContext } from "./content.ts"
import type { Driver, DriverEvent, RunRequest } from "./driver.ts"
import { AgentFailure, type AgentError } from "./errors.ts"

/** The observable loop: every phase is an event a hook can see. */
export type HarnessEvent =
  | { readonly _tag: "RunStarted"; readonly agent: string; readonly context: AgentContext }
  | DriverEvent
  | { readonly _tag: "ToolStarted"; readonly agent: string; readonly callId: string; readonly tool: string; readonly input: unknown }
  | { readonly _tag: "ToolCompleted"; readonly agent: string; readonly callId: string; readonly tool: string; readonly output: unknown }
  | { readonly _tag: "Output"; readonly agent: string; readonly output: unknown }
  | { readonly _tag: "RunFailed"; readonly agent: string; readonly error: AgentError }
  | { readonly _tag: "RunCompleted"; readonly agent: string }

export interface HarnessHook<E = never, R = never> {
  readonly name: string
  readonly handle: (event: HarnessEvent) => Effect.Effect<void, E, R>
}

/** A failing hook is an agent failure attributed to the hook. */
const emit = <E, R>(hooks: ReadonlyArray<HarnessHook<E, R>>, event: HarnessEvent) =>
  Effect.forEach(
    hooks,
    (hook) =>
      hook.handle(event).pipe(
        Effect.mapError((cause) => new AgentFailure({
          agent: "hook:" + hook.name,
          cause,
          message: "HarnessHook " + hook.name + " failed on " + event._tag
        }))
      ),
    { discard: true }
  )

const instrument = <A, R, E, RH>(
  driver: Driver<any>,
  request: RunRequest<A, R>,
  hooks: ReadonlyArray<HarnessHook<E, RH>>
): RunRequest<A, R | RH> => ({
  ...request,
  access: request.access.map(({ binding, write }) => ({
    write,
    binding: {
      ...binding,
      ops: binding.ops?.map((op) => ({
        ...op,
        execute: (input: unknown) => {
          const callId = crypto.randomUUID()
          return emit(hooks, { _tag: "ToolStarted", agent: driver.id, callId, tool: op.name, input }).pipe(
            Effect.flatMap(() => op.execute(input) as Effect.Effect<unknown, any, RH>),
            Effect.tap((output) => emit(hooks, { _tag: "ToolCompleted", agent: driver.id, callId, tool: op.name, output }))
          ) as Effect.Effect<unknown, AgentError, RH>
        }
      }))
    }
  })),
  report: (event: DriverEvent) => Effect.all([request.report?.(event) ?? Effect.void, emit(hooks, event)], { discard: true })
}) as RunRequest<A, R | RH>

export const Harness = {
  hook: <E = never, R = never>(name: string, handle: HarnessHook<E, R>["handle"]): HarnessHook<E, R> => ({ name, handle }),

  /** Wrap a driver with hooks: the same loop, now observable end to end. */
  withHooks: <E = never, RH = never, RD = never>(
    driver: Driver<RD>,
    ...hooks: ReadonlyArray<HarnessHook<E, RH>>
  ): Driver<RD | RH> => ({
    ...driver,
    run: <A, R>(request: RunRequest<A, R>) =>
      emit(hooks, { _tag: "RunStarted", agent: driver.id, context: request.context }).pipe(
        Effect.flatMap(() => driver.run(instrument(driver, request, hooks))),
        Effect.tap((output) => emit(hooks, { _tag: "Output", agent: driver.id, output })),
        Effect.tapError((error) => emit(hooks, { _tag: "RunFailed", agent: driver.id, error: error as AgentError }).pipe(Effect.ignore)),
        Effect.tap(() => emit(hooks, { _tag: "RunCompleted", agent: driver.id }))
      ) as Effect.Effect<A, AgentError, R | RH>
  })
}

export const ConsoleHook = Harness.hook("console", (event) =>
  Effect.sync(() => {
    switch (event._tag) {
      case "ToolStarted":
        console.log("[" + event.agent + "] tool -> " + event.tool)
        break
      case "ToolCompleted":
        console.log("[" + event.agent + "] tool ok " + event.tool)
        break
      case "RunFailed":
        console.error("[" + event.agent + "] failed", event.error)
        break
      case "RunCompleted":
        console.log("[" + event.agent + "] completed")
        break
    }
  }))

