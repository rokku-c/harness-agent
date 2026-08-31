/**
 * Auto-discovers examples/*.ts and runs them in filename order.
 *
 *   bun run examples            # offline examples only
 *   bun run examples 02         # only files matching "02"
 *   bun run examples --live     # include the live ones (-live files, real provider)
 *
 * Live examples self-gate on LLM_API_KEY; the runner still skips them by
 * default so an offline pass never spends tokens by accident.
 */
const root = new URL("..", import.meta.url).pathname
const live = process.argv.includes("--live")
const filter = process.argv.slice(2).find((arg) => !arg.startsWith("--"))

const glob = new Bun.Glob("examples/*.ts")
const files = (await Array.fromAsync(glob.scan({ cwd: root }))).sort()

const results: Array<{ file: string; status: "pass" | "fail" | "skip" }> = []
for (const file of files) {
  const isLive = file.includes("-live")
  if (isLive && !live) {
    results.push({ file, status: "skip" })
    continue
  }
  if (filter !== undefined && !file.includes(filter)) {
    results.push({ file, status: "skip" })
    continue
  }
  console.log(`\
--- ${file} ---`)
  const child = Bun.spawn(["bun", "run", `${root}${file}`], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit"
  })
  const code = await child.exited
  results.push({ file, status: code === 0 ? "pass" : "fail" })
}

console.log(`\
--- summary ---`)
for (const result of results)
  console.log(`  ${result.status.padEnd(4)} ${result.file}`)
const failures = results.filter((r) => r.status === "fail").length
if (failures > 0) process.exit(1)
