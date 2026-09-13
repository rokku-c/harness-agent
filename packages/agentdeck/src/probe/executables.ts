/** locating and versioning the agent executables on this machine. */
import { access, constants } from "node:fs/promises"
import { delimiter, join } from "node:path"
import { spawn } from "node:child_process"

/** the first executable named `file` on PATH, or undefined */
export const which = async (
  file: string,
  path: string = process.env.PATH ?? ""
): Promise<string | undefined> => {
  for (const dir of path.split(delimiter)) {
    if (dir.length === 0) continue
    const candidate = join(dir, file)
    const ok = await access(candidate, constants.X_OK).then(() => true).catch(() => false)
    if (ok) return candidate
  }
  return undefined
}

const VERSION_TIMEOUT_MS = 5_000

/** ask the executable its version. Bounded: a CLI that waits on a TTY must not
 *  hang the probe, so stdin is closed and a timeout kills it. */
export const version = async (
  file: string,
  argv: ReadonlyArray<string> = ["--version"]
): Promise<string | undefined> =>
  new Promise((resolve) => {
    const child = spawn(file, [...argv], { stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    let settled = false
    const finish = (value: string | undefined): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => { child.kill("SIGKILL"); finish(undefined) }, VERSION_TIMEOUT_MS)
    child.stdout.on("data", (raw: Buffer) => { out += raw.toString("utf-8") })
    child.stderr.on("data", (raw: Buffer) => { out += raw.toString("utf-8") })
    child.on("error", () => finish(undefined))
    child.on("close", () => {
      const line = out.split("\n").map((part) => part.trim()).find((part) => part.length > 0)
      finish(line)
    })
  })
