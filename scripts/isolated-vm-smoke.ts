/**
 * isolated-vm real-isolation smoke test (requires node: bun's V8 ABI is
 * incompatible with the isolated-vm native module). Verifies:
 * execution/injection, constructor escape blocking, memory limit, and a
 * node:vm escape comparison.
 *   node --experimental-strip-types scripts/isolated-vm-smoke.ts
 */
process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT:", (error as Error).stack ?? String(error))
  process.exit(1)
})
import { IsolatedVmRuntime, NodeVmRuntime } from "../packages/script/src/sandbox.ts"

const host = {
  defineTool: (spec: { name: string; deps?: ReadonlyArray<string> }) =>
    console.log("  defineTool:", spec.name, "deps =", spec.deps)
}
const env = {
  "weather.lookup": { name: "weather.lookup", invoke: async () => ({ temp: 24 }) }
}

// 1. execute + injected dep calls
const r1 = await IsolatedVmRuntime.execute(
  'const w = await weather.lookup({ city: "Shanghai" })\nreturn { temp: w.temp }',
  env,
  host
)
console.log("1) execute + injected dep:", JSON.stringify(r1))

// 2. constructor escape blocking (no host objects inside isolated-vm)
// weather.lookup is an async function → its constructor is AsyncFunction → calling it returns a promise,
// process being undefined is an async rejection, so await is needed to catch it
const evil = [
  "const Host = weather.lookup.constructor",
  "try { const p = await Host(\"return process\")(); return \"ESCAPED:\" + (p ? \"yes\" : \"no\") } catch (error) { return \"blocked\" }"
].join("\n")
const r2 = await IsolatedVmRuntime.execute(evil, env, host)
console.log("2) isolated-vm escape blocked:", r2)

// 3. memory limit
try {
  await IsolatedVmRuntime.execute(
    "const a = []\nwhile (true) a.push(new Array(1024 * 1024).fill(0))",
    {},
    host,
    3000
  )
  console.log("3) OOM: NOT rejected (BAD)")
} catch (error) {
  console.log("3) memory limit enforced:", String(error).slice(0, 60))
}

// 4. node:vm control: the same malicious script should escape (proving the isolation difference)
const r3 = await NodeVmRuntime.execute(evil, env, host)
console.log("4) node:vm control (expect ESCAPED):", r3)
