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

const r1 = await IsolatedVmRuntime.execute(
  'const w = await weather.lookup({ city: "Shanghai" })\nreturn { temp: w.temp }',
  env,
  host
)
console.log("1) execute + injected dep:", JSON.stringify(r1))

const evil = [
  "const Host = weather.lookup.constructor",
  "try { const p = await Host(\"return process\")(); return \"ESCAPED:\" + (p ? \"yes\" : \"no\") } catch (error) { return \"blocked\" }"
].join("\n")
const r2 = await IsolatedVmRuntime.execute(evil, env, host)
console.log("2) isolated-vm escape blocked:", r2)

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

const r3 = await NodeVmRuntime.execute(evil, env, host)
console.log("4) node:vm control (expect ESCAPED):", r3)
