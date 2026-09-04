/**
 * sandbox/isolated.ts - IsolatedVmRuntime (recommended default).
 *
 * Concept: a truly independent V8 isolate (isolated-vm): independent heap +
 * memoryLimit, cross-isolate injection only via Callback (no host objects
 * inside the context - the constructor-chain escape surface disappears),
 * restricted injection (no host console, only an explicit log), and a JSON
 * result channel (7.x only transfers primitives). The async bridge bootstrap
 * comes from isolated-setup.ts; the native module loads lazily (see
 * ivm-loader.ts - unavailable under bun).
 */
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
      // restricted injection: defineTool + log (both Callbacks; they become plain functions once transferred into the isolate)
      global.setSync("defineTool", new ivm.Callback(host.defineTool))
      global.setSync("log", new ivm.Callback((...args: unknown[]) => console.log(...args)))
      // async bridge (id channel): Callback args are copied with ExternalCopy (functions cannot be transferred),
      // so no callback is passed: a script-side __pending map + a host-side resolve callback.
      const byName = new Map(Object.entries(env))
      if (byName.size > 0) {
        // setup: __pending/__resolve/__wrap + assembly into dot-separated namespaces
        const setup = buildSetup([...byName.keys()])
        await context.eval(setup)
        // host→isolate: getSync retrieves a callable proxy of the script-side __resolve; invoke it directly
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
      // script body = async IIFE: supports top-level await and return.
      // note: 7.x eval result.copy/reference does not work for object results (only primitives can be transferred),
      // so results go through a JSON channel: JSON.stringify inside the isolate → string (transferable) → host parses it.
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
