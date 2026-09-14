import type { ScriptRuntime } from "./host.ts"
import { loadIvm } from "./ivm-loader.ts"
import { buildSetup } from "./isolated-setup.ts"

export const IsolatedVmRuntime: ScriptRuntime = {
  runtime: "isolated-vm",
  execute: async (source, env, host, timeoutMs = 5000, memoryMb = 64) => {
    const ivm = await loadIvm()
    const isolate = new ivm.Isolate({ memoryLimit: memoryMb })
    try {
      const context = isolate.createContextSync()
      const global = context.global
      global.setSync("defineTool", new ivm.Callback(host.defineTool))
      global.setSync("log", new ivm.Callback((...args: unknown[]) => console.log(...args)))
      const byName = new Map(Object.entries(env))
      if (byName.size > 0) {
        const setup = buildSetup([...byName.keys()])
        await context.eval(setup)
        const resolveIntoIsolate = global.getSync("__resolve") as unknown as (
          id: unknown,
          value: unknown
        ) => unknown
        global.setSync(
          "__call",
          new ivm.Callback((name: unknown, input: unknown, id: unknown) => {
            const api = byName.get(name as string)
            const done = (value: unknown) => {
              try {
                resolveIntoIsolate(id, value)
              } catch {
                // e.g. isolate already disposed: ignore
              }
            }
            if (api === undefined) {
              done({ __error: "unknown dep: " + String(name) })
              return
            }
            api.invoke(input).then(done, (error: unknown) => done({ __error: String(error) }))
          })
        )
      }
      const wrapped =
        "(async () => {\nconst __result = (async () => {\n" + source + "\n})()\n" +
        "return JSON.stringify(await __result)\n})()"
      const json = (await context.eval(wrapped, {
        promise: true,
        timeout: timeoutMs
      })) as unknown
      if (json === undefined || json === null) return undefined
      return JSON.parse(json as string)
    } finally {
      isolate.dispose()
    }
  }
}
