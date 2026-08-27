import { Effect, Fiber, Stream } from "effect"
import type { ReprClient } from "@effect-agent/repr"
import { createTui } from "./index.js"

export interface NodeTuiOptions {
  readonly input?: NodeJS.ReadStream
  readonly output?: NodeJS.WriteStream
}

/** Runnable Node terminal host. Rendering and intents remain platform-neutral. */
export const runTui = (client: ReprClient, options: NodeTuiOptions = {}): Effect.Effect<void, Error> =>
  Effect.async<void, Error>((resume) => {
    const input = options.input ?? process.stdin
    const output = options.output ?? process.stdout
    const viewport = () => ({ columns: output.columns ?? 80, rows: output.rows ?? 24 })
    let stopped = false

    const draw = () => {
      const tui = createTui(client, viewport())
      Effect.runPromise(tui.frame).then((frame) => {
        if (!stopped) output.write(`\u001b[?25l\u001b[H\u001b[2J${frame}`)
      }, (error) => finish(error instanceof Error ? error : new Error(String(error))))
    }

    const onData = (data: Buffer) => {
      for (const key of data.toString("utf8")) {
        if (key === "q" || key === "\u0003") { finish(); return }
        Effect.runPromise(createTui(client, viewport()).handle(key)).then(draw, (error) =>
          finish(error instanceof Error ? error : new Error(String(error))))
      }
    }

    const onResize = () => draw()
    const changesFiber = Effect.runFork(Stream.runForEach(client.changes, () => Effect.sync(draw)))

    const cleanup = () => {
      if (input.isTTY) input.setRawMode(false)
      input.pause()
      input.off("data", onData)
      output.off("resize", onResize)
      output.write("\u001b[?25h\n")
      Effect.runFork(Fiber.interrupt(changesFiber))
    }

    function finish(error?: Error) {
      if (stopped) return
      stopped = true
      cleanup()
      resume(error ? Effect.fail(error) : Effect.void)
    }

    if (input.isTTY) input.setRawMode(true)
    input.resume()
    input.on("data", onData)
    output.on("resize", onResize)
    draw()

    return Effect.sync(() => finish())
  })
