/**
 * Sandbox executor: a script can only see the deps it declares (least-privilege injection).
 * Default implementation IsolatedVmRuntime (isolated-vm: an independent V8 isolate; only
 * references cross the isolate boundary, no host-object escape surface); NodeVmRuntime is kept as
 * a zero-dependency fallback skeleton (note: node:vm is not a real sandbox — once host objects
 * are injected, the constructor chain can escape).
 * defineTool bootstrap: new tools defined by a script are validated by the host and registered
 * into the registry — the api set grows.
 */
import vm from "node:vm"
import type { ToolDef } from "./types.ts"

/**
 * Lazy-load isolated-vm: it is a native module (compiled against node's V8 ABI), so dlopen
 * fails under bun. A top-level import would make the whole package unusable under bun,
 * so it is loaded only inside execute; under bun an explicit error is thrown
 * (switch to NodeVmRuntime or run under node).
 */
const loadIvm = async (): Promise<{
  Isolate: new (options: { memoryLimit: number }) => {
    createContextSync(): {
      global: {
        setSync: (key: string, value: unknown) => void
        deleteSync: (key: string) => void
        getSync: (key: string) => unknown
      }
      eval: (code: string, options?: Record<string, unknown>) => Promise<unknown>
    }
    dispose: () => void
  }
  Callback: new <T extends (...args: never[]) => unknown>(
    fn: T,
    options?: { async?: boolean }
  ) => unknown
}> => {
  const loaded = await import("isolated-vm").catch(() => {
    throw new Error(
      "isolated-vm is unavailable: the native module cannot load under the current runtime. " +
        "bun's V8 ABI is incompatible with the prebuilt isolated-vm binary — run under node or use NodeVmRuntime."
    )
  })
  const mod = (loaded as { default?: unknown }).default ?? loaded
  return mod as unknown as {
    Isolate: new (options: { memoryLimit: number }) => {
      createContextSync(): {
        global: {
          setSync: (key: string, value: unknown) => void
          deleteSync: (key: string) => void
          getSync: (key: string) => unknown
        }
        eval: (code: string, options?: Record<string, unknown>) => Promise<unknown>
      }
      dispose: () => void
    }
    Callback: new <T extends (...args: never[]) => unknown>(
      fn: T,
      options?: { async?: boolean }
    ) => unknown
  }
}

/** Dependency apis injected into scripts: invoked by tool name. */
export interface ToolApi {
  readonly name: string
  readonly invoke: (input: unknown) => Promise<unknown>
}

export interface DefineToolSpec {
  readonly name: string
  readonly description: string
  readonly semver?: string
  readonly input: ToolDef["input"]
  readonly output: ToolDef["output"]
  /** Declared deps must be ⊆ the current env keys (host-validated, prevents privilege escalation). */
  readonly deps?: ReadonlyArray<string>
  readonly source: string
}

export interface ScriptHost {
  readonly defineTool: (spec: DefineToolSpec) => void
}

export interface ScriptRuntime {
  readonly runtime: "quickjs" | "graaljs" | "node-vm" | "isolated-vm"
  /** Execute a tool script; env only contains the deps it declares. Returns the script's final value. */
  readonly execute: (
    source: string,
    env: Readonly<Record<string, ToolApi>>,
    host: ScriptHost,
    timeoutMs?: number
  ) => Promise<unknown>
}

/** Inject layer by layer along dots: weather.lookup → the global weather.lookup(...) becomes directly callable. */
export const injectNamespace = (
  target: Record<string, unknown>,
  key: string,
  fn: unknown
): void => {
  const segments = key.split(".")
  let cursor = target
  for (const segment of segments.slice(0, -1)) {
    const existing = cursor[segment]
    if (existing === null || typeof existing !== "object") cursor[segment] = {}
    cursor = cursor[segment] as Record<string, unknown>
  }
  cursor[segments.at(-1) ?? key] = fn
}

/** Default implementation: node:vm (note: vm is not a real sandbox; production must switch to an isolated engine). */
export const NodeVmRuntime: ScriptRuntime = {
  runtime: "node-vm",
  execute: async (source, env, host, timeoutMs = 5000) => {
    const sandbox: Record<string, unknown> = {
      console,
      defineTool: host.defineTool
    }
    // inject dep apis into the global scope layer by layer, keyed by tool name (least-privilege surface)
    for (const [name, api] of Object.entries(env)) injectNamespace(sandbox, name, api.invoke)
    const context = vm.createContext(sandbox)
    // script body = async IIFE: supports top-level await and return
    const wrapped = "(async () => {\n" + source + "\n})()"
    const result = await vm.runInContext(wrapped, context, { timeout: timeoutMs })
    return result
  }
}

/**
 * Default implementation (recommended): isolated-vm — a truly independent V8 isolate.
 * - Independent heap + memoryLimit: a script cannot OOM the host or share host objects
 * - Cross-isolate injection only via Callback (no host objects inside the context ⟹
 *   the constructor-chain escape surface disappears)
 * - Restricted injection: no host console exposed, only an explicit log
 * - Async bridge: 7.x async Callback does not await host promises, so dep calls go through
 *   the __call sync bridge + callback echo-back; the script side wraps them into async
 *   functions via __wrap (API unchanged)
 * - Note: the native module targets node's V8 ABI; unavailable under bun (lazy load throws an explicit error)
 */
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
        const assignExpr = (segments: ReadonlyArray<string>, fn: string): string => {
          if (segments.length === 1) return "globalThis[" + JSON.stringify(segments[0]) + "] = " + fn
          const root = JSON.stringify(segments[0])
          let current = "globalThis[" + root + "]"
          const lines: string[] = []
          // first ensure the root object exists, then ensure each intermediate object exists level by level
          lines.push(current + " = " + current + " ?? {}")
          for (let i = 1; i < segments.length - 1; i++) {
            const key = JSON.stringify(segments[i])
            current += "[" + key + "]"
            lines.push(current + " = " + current + " ?? {}")
          }
          lines.push(current + "[" + JSON.stringify(segments.at(-1)) + "] = " + fn)
          return lines.join("\n")
        }
        const setup = [
          "let __seq = 0",
          "const __pending = new Map()",
          "globalThis.__resolve = (id, value) => {",
          "  const entry = __pending.get(id)",
          "  if (entry === undefined) return",
          "  __pending.delete(id)",
          "  if (value !== null && typeof value === \"object\" && value.__error !== undefined)",
          "    entry.reject(new Error(value.__error))",
          "  else entry.resolve(value)",
          "}",
          "const __wrap = (name) => async (input) => {",
          "  const id = ++__seq",
          "  const promise = new Promise((resolve, reject) => __pending.set(id, { resolve, reject }))",
          "  __call(name, input, id)",
          "  return promise",
          "}",
          ...[...byName.keys()].map((name) =>
            assignExpr(name.split("."), "__wrap(" + JSON.stringify(name) + ")")
          )
        ].join("\n")
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

/** Convenience: build a ToolApi from a ToolDef's script impl (env injection is assembled by the caller). */
export const scriptToolApi = (
  tool: ToolDef,
  runtime: ScriptRuntime,
  buildEnv: (deps: ReadonlyArray<string>) => Readonly<Record<string, ToolApi>>,
  register: (spec: DefineToolSpec) => void
): ToolApi => {
  if (tool.impl.kind !== "script")
    return { name: tool.name, invoke: (input) => Promise.resolve(input) }
  const impl = tool.impl // narrowed to the script variant
  const host: ScriptHost = { defineTool: register }
  return {
    name: tool.name,
    invoke: (input) => runtime.execute(impl.source, buildEnv(tool.deps), host)
  }
}
