import type { ToolDef } from "../types.ts"
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
  readonly deps?: ReadonlyArray<string>
  readonly source: string
}

export interface ScriptHost {
  readonly defineTool: (spec: DefineToolSpec) => void
}

export interface ScriptRuntime {
  readonly runtime: "quickjs" | "graaljs" | "node-vm" | "isolated-vm"
  readonly execute: (
    source: string,
    env: Readonly<Record<string, ToolApi>>,
    host: ScriptHost,
    timeoutMs?: number
  ) => Promise<unknown>
}

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
export const scriptToolApi = (
  tool: ToolDef,
  runtime: ScriptRuntime,
  buildEnv: (deps: ReadonlyArray<string>) => Readonly<Record<string, ToolApi>>,
  register: (spec: DefineToolSpec) => void
): ToolApi => {
  if (tool.impl.kind !== "script")
    return { name: tool.name, invoke: (input) => Promise.resolve(input) }
  const impl = tool.impl
  const host: ScriptHost = { defineTool: register }
  return {
    name: tool.name,
    invoke: (input) => runtime.execute(impl.source, buildEnv(tool.deps), host)
  }
}
