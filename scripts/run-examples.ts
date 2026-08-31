/**
 * The example runner: auto-discovers examples/*.ts, runs them in order.
 * Files containing "-live" only run with --live. A positional filter arg
 * matches by substring (e.g. "bun run examples 02").
 */
const live = process.argv.includes("--live")
const filter = process.argv.slice(2).find((arg) => !arg.startsWith("--"))

const files = []
for (const path of new Bun.Glob("examples/*.ts").scanSync({ cwd: import.meta.dir + "/.." })) {
  files.push(path)
}
files.sort()

let failed = 0
const results: Array<{ file: string; status: string }> = []
for (const file of files) {
  const isLive = file.includes("-live")
  if (isLive && !live) {
    results.push({ file, status: "skip" })
    continue
  }
  if (filter && !file.includes(filter)) {
    results.push({ file, status: "skip" })
    continue
  }
  const proc = Bun.spawnSync(["bun", file], { cwd: import.meta.dir + "/..", stdout: "inherit", stderr: "inherit" })
  const status = proc.exitCode === 0 ? "pass" : "fail"
  if (proc.exitCode !== 0) failed++
  results.push({ file, status })
}

console.log("--- summary ---")
for (const result of results) console.log(" ", result.status, result.file)
if (failed > 0) process.exit(1)

