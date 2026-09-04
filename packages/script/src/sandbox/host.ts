/**
 * sandbox/host.ts - the SCRIPT HOST CONTRACT + glue.
 *
 * Concept: a script runs with only the deps it declares (least-privilege
 * injection). ToolApi is one dependency as the script sees it; ScriptRuntime
 * executes one script over an env of ToolApis and a host surface (defineTool
 * bootstrap); injectNamespace dots keys into a global layer by layer;
 * scriptToolApi wraps a ToolDef's script impl into a ToolApi.
 */
import type { ToolDef } from "../types.ts"
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
