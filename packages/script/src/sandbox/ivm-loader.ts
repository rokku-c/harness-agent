/**
 * sandbox/ivm-loader.ts - LAZY isolated-vm LOADING.
 *
 * Concept: isolated-vm is a native module compiled against node's V8 ABI, so
 * dlopen fails under bun. A top-level import would make the whole package
 * unusable under bun; it is loaded only inside execute, where an explicit
 * error explains the fallback (NodeVmRuntime) or switching to node.
 */
/**
 * Lazy-load isolated-vm: it is a native module (compiled against node's V8 ABI), so dlopen
 * fails under bun. A top-level import would make the whole package unusable under bun,
 * so it is loaded only inside execute; under bun an explicit error is thrown
 * (switch to NodeVmRuntime or run under node).
 */
export const loadIvm = async (): Promise<{
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
