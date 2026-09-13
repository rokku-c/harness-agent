/**
 * agentdeck/adapters/cli-turn - one CLI turn: spawn the agent for a session,
 * watch it to terminal, and return the outcome.
 *
 * The box carries what only a turn knows — the live child. The status the turn
 * leaves behind is `session-table.ts`'s, applied from the outcome; a turn
 * resolves exactly once whatever ends it: output, a spawn error, a timeout, or
 * the operator closing the session mid-turn.
 */
import { spawn, type ChildProcess } from "node:child_process"
import type { AgentKind } from "../kinds.ts"
import type { SendOutcome } from "../flow.ts"
import type { UnifiedAgentConfig } from "../config-types.ts"
import type { SessionBox } from "./session-table.ts"

export interface CliBox extends SessionBox {
  readonly kind: AgentKind
  readonly config: UnifiedAgentConfig
  readonly turns: Array<{ role: "user" | "agent"; content: string; at: number }>
  active?: ChildProcess
  closed?: boolean
}

export const runTurn = (
  box: CliBox,
  invocation: { readonly file: string; readonly argv: ReadonlyArray<string> }
): Promise<SendOutcome> =>
  new Promise((resolve) => {
    const { file, argv } = invocation
    const env = { ...process.env as Record<string, string> }
    for (const [k, v] of (box.config.env ?? new Map())) env[k] = v
    const child = spawn(file, [...argv], { cwd: box.config.cwd, env, stdio: ["ignore", "pipe", "pipe"], detached: true })
    box.active = child
    let out = ""
    let err = ""
    let settled = false
    const timer = box.config.turnTimeoutMs === undefined
      ? undefined
      : setTimeout(() => { if (!settled) { settled = true; child.kill("SIGTERM"); finish({ ok: false, detail: "turn timed out after " + box.config.turnTimeoutMs + "ms" }) } }, box.config.turnTimeoutMs)
    const finish = (outcome: SendOutcome) => {
      if (timer !== undefined) clearTimeout(timer)
      resolve(outcome)
    }
    child.stdout.on("data", (raw: Buffer) => { out += raw.toString("utf-8") })
    child.stderr.on("data", (raw: Buffer) => { err += raw.toString("utf-8") })
    child.on("error", (error) => { if (!settled) { settled = true; finish({ ok: false, detail: error.message }) } })
    child.on("exit", (code) => {
      if (settled) return
      settled = true
      box.active = undefined
      if (box.closed) { finish({ ok: false, detail: "closed by operator mid-turn" }); return }
      const text = out.trim()
      if (code === 0) finish({ ok: text.length > 0, text: text.length > 0 ? text : undefined, detail: text.length > 0 ? undefined : "empty output" })
      else finish({ ok: false, detail: (err.trim() || text || "exit code " + code).slice(0, 400) })
    })
  })
