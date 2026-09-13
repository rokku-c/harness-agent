/**
 * ssh transport. A daemon must never block on a password prompt, so BatchMode
 * is on by default: an unreachable or unauthenticated target fails fast and
 * visibly instead of hanging a control loop.
 */
import { spawn } from "node:child_process"
import type { RemoteRun, RemoteRunOptions, RemoteTarget, RemoteTransport } from "./types.ts"

export const DEFAULT_TIMEOUT_MS = 30_000

/** single-quote a fragment for POSIX sh */
export const quote = (value: string): string => `'${value.split("'").join(`'\\''`)}'`

export const sshArgs = (target: RemoteTarget): ReadonlyArray<string> => [
  "-o", "BatchMode=yes",
  "-o", "ConnectTimeout=10",
  ...(target.port !== undefined ? ["-p", String(target.port)] : []),
  ...(target.identity !== undefined ? ["-i", target.identity] : []),
  ...(target.options ?? []),
  target.user !== undefined ? `${target.user}@${target.host}` : target.host
]

export const makeSshTransport = (target: RemoteTarget): RemoteTransport => ({
  target,
  run: (command: string, options: RemoteRunOptions = {}): Promise<RemoteRun> =>
    new Promise((resolve) => {
      const remote = options.cwd !== undefined ? `cd ${quote(options.cwd)} && ${command}` : command
      const child = spawn("ssh", [...sshArgs(target), remote], { stdio: ["pipe", "pipe", "pipe"] })
      const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
      let stdout = ""
      let stderr = ""
      let settled = false
      const finish = (code: number, timedOut: boolean): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve({ code, stdout, stderr, timedOut })
      }
      const timer = setTimeout(() => { child.kill("SIGKILL"); finish(-1, true) }, timeoutMs)
      child.stdout.on("data", (raw: Buffer) => { stdout += raw.toString("utf-8") })
      child.stderr.on("data", (raw: Buffer) => { stderr += raw.toString("utf-8") })
      child.on("error", (error) => { stderr += error.message; finish(-1, false) })
      child.on("close", (code) => finish(code ?? -1, false))
      if (options.stdin !== undefined) child.stdin.end(options.stdin)
      else child.stdin.end()
    })
})
