/**
 * sandbox/isolated-setup.ts - the ISOLATE-SIDE ASYNC BRIDGE bootstrap.
 *
 * Concept: 7.x async Callbacks cannot await host promises and functions
 * cannot be transferred across the isolate, so dep calls go through a
 * __call sync bridge with a script-side __pending map + host-side __resolve
 * echo. This builder emits that setup (plus dot-namespace assembly) as one
 * eval-able string over the given dep names.
 */
const assignExpr = (segments: ReadonlyArray<string>, fn: string): string => {
  if (segments.length === 1) return "globalThis[" + JSON.stringify(segments[0]) + "] = " + fn
  const root = JSON.stringify(segments[0])
  let current = "globalThis[" + root + "]"
  const lines: string[] = []
  // first ensure the root object exists, then each intermediate object level by level
  lines.push(current + " = " + current + " ?? {}")
  for (let i = 1; i < segments.length - 1; i++) {
    const key = JSON.stringify(segments[i])
    current += "[" + key + "]"
    lines.push(current + " = " + current + " ?? {}")
  }
  lines.push(current + "[" + JSON.stringify(segments.at(-1)) + "] = " + fn)
  return lines.join("\n")
}

export const buildSetup = (names: ReadonlyArray<string>): string => {
  const parts = [
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
    ...names.map((name) => assignExpr(name.split("."), "__wrap(" + JSON.stringify(name) + ")"))
  ]
  return parts.join("\n")
}
