/**
 * agentdeck/adapters/cli - generic NON-INTERACTIVE CLI agent gateway
 * (claude-code -p, codex exec, gemini cli, pi, custom commands).
 * Config mapping is the point: a UnifiedAgentConfig renders to the exact
 * spawn argv for the kind (ask 3); flow control spawns/kills per session.
 */
import { spawn, type ChildProcess } from "node:child_process"
import type { AgentKind, OpenSessionRequest, SendOutcome, SessionGateway, SessionStatus, UnifiedAgentConfig } from "../types.ts"

/** declarative per-kind CLI dialect: how one turn becomes a process argv */
export interface CliPreset {
  readonly file: string
  /** argv BEFORE the prompt text (the prompt is appended last) */
  readonly argv: (prompt: string) => ReadonlyArray<string>
}

export const cliPresets: Readonly<Record<string, CliPreset>> = {
  "claude-code": { file: "claude", argv: () => ["-p"] },
  codex: { file: "codex", argv: () => ["exec"] },
  gemini: { file: "gemini", argv: () => [] }, // gemini >=0.24: positional one-shot prompt
  pi: { file: "pi", argv: () => ["-p"] },
  custom: { file: "agent", argv: () => [] }
}

/** standalone render: unified config -> exact spawn {file, argv} for one turn
 * (shared by the gateway and by products that want to SHOW the plan before
 * running it). prompt is appended last. */
export const cliInvocation = (
  config: UnifiedAgentConfig,
  prompt: string,
  presetMap: Readonly<Record<string, CliPreset>> = cliPresets
): { file: string; argv: ReadonlyArray<string> } => {
  const preset = presetMap[config.kind] ?? presetMap.custom
  const prefix: ReadonlyArray<string> = config.command !== undefined ? (config.args ?? []) : preset.argv(prompt)
  return { file: config.command ?? preset.file, argv: [...prefix, prompt] }
}

export interface CliGatewayOptions {
  /** override/add CLI dialects (e.g. a "*claw"-like agent) */
  readonly presets?: Readonly<Record<string, CliPreset>>
}

interface CliBox {
  readonly sessionId: string
  readonly kind: AgentKind
  readonly config: UnifiedAgentConfig
  readonly turns: Array<{ role: "user" | "agent"; content: string; at: number }>
  status: SessionStatus["status"]
  detail?: string
  lastActivityAt?: number
  active?: ChildProcess
  closed?: boolean
}

export const makeCliGateway = (kind: AgentKind, options: CliGatewayOptions = {}): SessionGateway => {
  const presets = { ...cliPresets, ...(options.presets ?? {}) }
  const boxes = new Map<string, CliBox>()
  let seq = 0

  /** unified config -> { file, argv } for one turn (ask 3, lossless) */
  const argvFor = (config: UnifiedAgentConfig, prompt: string): { file: string; argv: Array<string> } =>
    ({ ...cliInvocation(config, prompt, presets), argv: [...cliInvocation(config, prompt, presets).argv] })

  const runTurn = (box: CliBox, prompt: string): Promise<SendOutcome> =>
    new Promise((resolve) => {
      const { file, argv } = argvFor(box.config, prompt)
      const env = { ...process.env as Record<string, string> }
      for (const [k, v] of (box.config.env ?? new Map())) env[k] = v
      box.status = "running"
      box.lastActivityAt = Date.now()
      const child = spawn(file, argv, { cwd: box.config.cwd, env, stdio: ["ignore", "pipe", "pipe"], detached: true })
      box.active = child
      let out = ""
      let err = ""
      let settled = false
      const timer = box.config.turnTimeoutMs === undefined
        ? undefined
        : setTimeout(() => { if (!settled) { settled = true; child.kill("SIGTERM"); finish({ ok: false, detail: "turn timed out after " + box.config.turnTimeoutMs + "ms" }) } }, box.config.turnTimeoutMs)
      const finish = (outcome: SendOutcome) => {
        box.status = outcome.ok ? "idle" : "failed"
        box.lastActivityAt = Date.now()
        if (!outcome.ok) box.detail = outcome.detail
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

  return {
    kind,
    open: async (request: OpenSessionRequest) => {
      const sessionId = request.sessionId ?? kind + "-" + (++seq).toString(36)
      const box: CliBox = { sessionId, kind: request.config.kind, config: request.config, turns: [], status: "idle", lastActivityAt: Date.now() }
      boxes.set(sessionId, box)
      return { sessionId, kind: request.config.kind, status: "idle", lastActivityAt: box.lastActivityAt }
    },
    close: async (sessionId: string) => {
      const box = boxes.get(sessionId)
      if (box !== undefined) {
        box.closed = true
        const child = box.active
        if (child !== undefined && child.pid !== undefined) {
          const group = -child.pid
          try { process.kill(group, "SIGTERM") } catch { child.kill("SIGTERM") }
          setTimeout(() => { try { process.kill(group, "SIGKILL") } catch { child.kill("SIGKILL") } }, 400)
        }
      }
      boxes.delete(sessionId)
    },
    send: async (sessionId: string, text: string): Promise<SendOutcome> => {
      const box = boxes.get(sessionId)
      if (box === undefined) return { ok: false, detail: "unknown session " + sessionId }
      if (box.status === "running") return { ok: false, detail: "session busy: a turn is already running" }
      const at = Date.now()
      const outcome = await runTurn(box, text)
      box.turns.push({ role: "user", content: text, at })
      if (outcome.ok && outcome.text !== undefined) box.turns.push({ role: "agent", content: outcome.text, at: Date.now() })
      return outcome
    },
    history: async (sessionId: string) => {
      const box = boxes.get(sessionId)
      if (box === undefined) throw new Error("unknown session " + sessionId)
      return box.turns
    },
    status: async (sessionId: string): Promise<SessionStatus> => {
      const box = boxes.get(sessionId)
      if (box === undefined) throw new Error("unknown session " + sessionId)
      return { sessionId, kind: box.kind, status: box.status, lastActivityAt: box.lastActivityAt, detail: box.detail }
    },
    sessions: () => [...boxes.values()].map((b) => ({ sessionId: b.sessionId, kind: b.kind, status: b.status, lastActivityAt: b.lastActivityAt, detail: b.detail }))
  }
}
