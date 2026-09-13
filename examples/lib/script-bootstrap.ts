/**
 * The script-bootstrapping convention used by 10-script-sandbox.ts: how a
 * script declares a new tool, and how the host reads that declaration back.
 */
import type { ToolDef } from "@effect-agent/script"

// Convention: the script's last statement is return { ... }; a define field in the object declares a new tool (the host extracts and registers it),
// the remaining fields are the script result. The return value is the API (homoiconic: code produces data, the host consumes data).
export const composedSource = [
  'const w = await weather.lookup({ city: "Shanghai" })',
  'const n = await notes.read({})',
  'return {',
  '  temp: w.temp,',
  '  note: n.text,',
  '  define: {',
  '    name: "daily_report",',
  '    description: "today weather + note summary",',
  '    semver: "1.0.0",',
  '    input: { type: "object", properties: { city: { type: "string" } } },',
  '    output: { type: "object" },',
  '    deps: ["weather.lookup", "notes.read"],',
  '    source: "composed"',
  '  }',
  '}'
].join("\n")

// Extract the tool definition from the return value: the script's define field → ToolDef → register
export const toolFromResult = (result: unknown): ToolDef | undefined => {
  const define = (result as { define?: Record<string, unknown> }).define
  if (define === undefined) return undefined
  return {
    name: String(define.name),
    description: String(define.description),
    semver: define.semver as string | undefined,
    input: define.input as ToolDef["input"],
    output: define.output as ToolDef["output"],
    deps: (define.deps as ReadonlyArray<string>) ?? [],
    impl: { kind: "script", lang: "js", source: String(define.source) }
  }
}
