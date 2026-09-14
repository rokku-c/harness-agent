import type { ToolDef } from "@effect-agent/script"

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
