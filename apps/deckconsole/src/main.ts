/**
 * deckconsole - a small product ON TOP of @effect-agent/agentdeck: an HTTP
 * control room (JSON API + one dark management page) that drives every
 * registered agent through the three unified surfaces and shows the
 * session->consent map live. Boots with a scripted "demo" agent so the whole
 * flow works with zero models/bins; real agents (claude-code/codex/gemini/
 * pi/custom CLI, or the in-proc effect runtime with a model provider) plug
 * in through the same routes.
 */
import {
  AgentDeck, normalizeConfig, makeDemoGateway, makeCliGateway, cliInvocation, effectGateway,
  makeClaudeSdkGateway, makeEffectOpsGateway, cliPresets as builtinCliPresets, type UnifiedAgentConfig, type SessionGateway
} from "@effect-agent/agentdeck"
import type { Model, ClaudeCodeOptions } from "@effect-agent/builtin"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

export interface DeckServerOptions {
  readonly host?: string
  readonly port?: number
  /** optional effect-runtime model provider; enables the "effect" kind */
  readonly effectModel?: (config: UnifiedAgentConfig) => Model
  /** SDK query for the in-proc claude-code variant (kind "claude-cc") */
  readonly claudeSdk?: { readonly query: NonNullable<ClaudeCodeOptions["query"]> }
  /** one-click launch entries shown in the product (env DECK_AGENTS JSON too) */
  readonly launchers?: ReadonlyArray<{ kind: string; label: string; config?: unknown }>
  /** json state file for launcher persistence (env DECK_FILE too) */
  readonly configFile?: string
}

const lastTurn = new Map<string, string>()
const dynamicPresets = new Map<string, { file: string; args: ReadonlyArray<string> }>()
const allPresetsFor = (kind: string): Record<string, { file: string; argv: (prompt: string) => ReadonlyArray<string> }> => {
  const merged: Record<string, { file: string; argv: (prompt: string) => ReadonlyArray<string> }> = { ...builtinCliPresets }
  for (const [k, p] of dynamicPresets) merged[k] = { file: p.file, argv: () => p.args }
  void kind
  return merged
}
const cliInvocableKinds = (): ReadonlyArray<string> => ["custom", ...Object.keys(builtinCliPresets).filter((k) => k !== "custom"), ...dynamicPresets.keys()]

/** starter raw config per kind for the config-preview editor */
const CONFIG_SAMPLES: Readonly<Record<string, string>> = {
  "claude-code": '{ "model": "claude-sonnet-4-5", "cwd": "/workspace", "permissionMode": "bypassPermissions", "allowedTools": ["Read", "Edit"] }',
  "claude-cc": '{ "model": "claude-sonnet-4-5", "cwd": "/workspace", "consent": { "autoApproveTools": ["Read"], "defaultDecision": "ask" } }',
  "effect-ops": '{ "model": "scripted", "cwd": "/workspace", "consent": { "autoApproveTools": [], "defaultDecision": "ask" } }',
  codex: '{ "codexModel": "o4-mini", "cwd": "/workspace", "codexApprovalMode": "full-auto", "sandbox": "read-only" }',
  gemini: '{ "geminiModel": "gemini-2.5-pro", "cwd": "/workspace", "geminiProject": "my-project" }',
  pi: '{ "piModel": "pi-large", "cwd": "/workspace" }',
  effect: '{ "model": "deepseek", "systemPrompt": "你是一位严谨的工程师。", "maxSteps": 12 }',
  custom: '{ "label": "my-agent", "command": "myagent", "args": ["-m", "fast"], "cwd": "/workspace" }',
  demo: '{ "label": "演示", "consent": { "autoApproveTools": ["note_write"], "defaultDecision": "deny" } }'
}

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value, null, 1), { status, headers: { "content-type": "application/json; charset=utf-8" } })

const html = (body: string): Response =>
  new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } })

const envLaunchers = (): Array<{ kind: string; label: string; config?: unknown }> => {
  const raw = process.env.DECK_AGENTS
  if (raw === undefined) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter((x: unknown) => typeof x === "object" && x !== null &&
        typeof (x as { kind?: unknown }).kind === "string" && typeof (x as { label?: unknown }).label === "string") as Array<{ kind: string; label: string }>
    }
  } catch { /* ignore malformed env */ }
  return []
}

export const startDeckServer = (options: DeckServerOptions = {}) => {
  const deck = new AgentDeck()
  const configFile = options.configFile ?? process.env.DECK_FILE
  const launchers: Array<{ kind: string; label: string; config?: unknown }> = []
  const seedLauncher = (kind: string, label: string, config?: unknown): void => {
    const key = kind + "\u0000" + label
    if (!launchers.some((l) => l.kind + "\u0000" + l.label === key)) launchers.push(config === undefined ? { kind, label } : { kind, label, config })
  }
  for (const l of options.launchers ?? []) seedLauncher(l.kind, l.label, l.config)
  for (const l of envLaunchers()) seedLauncher(l.kind, l.label, l.config)
  if (options.effectModel !== undefined) seedLauncher("effect", "effect（进程内）")
  if (options.claudeSdk !== undefined) seedLauncher("claude-cc", "claude-cc（SDK 进程内）")
  if (options.effectModel !== undefined) seedLauncher("effect-ops", "effect-ops（审批执行循环）")
  const persistLaunchers = (): void => {
    if (configFile === undefined) return
    try {
      mkdirSync(dirname(configFile), { recursive: true })
      writeFileSync(configFile, JSON.stringify({ launchers }, null, 2), "utf-8")
    } catch (error) {
      console.error("deckconsole persist failed:", error instanceof Error ? error.message : String(error))
    }
  }
  if (configFile !== undefined) {
    try {
      const saved = JSON.parse(readFileSync(configFile, "utf-8")) as { launchers?: Array<{ kind: string; label: string }> }
      for (const l of saved.launchers ?? []) seedLauncher(l.kind, l.label)
    } catch { /* first boot: no file yet */ }
  }
  // per-session consent policy (autoApproveTools / defaultDecision from the
  // unified config) - recorded for the demo agent whose asks it can auto-settle
  const sessionPolicy = new Map<string, { auto: ReadonlySet<string>; mode: "ask" | "allow" | "deny" }>()
  deck.register(makeDemoGateway({
    ask: (sessionId: string, tool: string, input: unknown) => {
      const callId = deck.consent.ask(sessionId, tool, input)
      const policy = sessionPolicy.get(sessionId)
      if (policy !== undefined && (policy.auto.has(tool) || policy.mode !== "ask")) {
        deck.consent.resolve(callId, policy.auto.has(tool) || policy.mode === "allow", "auto")
      }
      return callId
    }
  }))
  if (options.claudeSdk !== undefined) deck.register(makeClaudeSdkGateway({ query: options.claudeSdk.query }))
  const cliByKind = new Map<string, SessionGateway>()

  const gatewayFor = (kind: string): SessionGateway => {
    const booted = deck.get(kind)
    if (booted !== undefined) return booted
    if (kind === "effect") {
      if (options.effectModel === undefined) throw new Error("effect kind needs effectModel at boot")
      const gw = effectGateway({ model: options.effectModel })
      deck.register(gw)
      return gw
    }
    if (kind === "effect-ops") {
      if (options.effectModel === undefined) throw new Error("effect-ops kind needs effectModel at boot")
      const gw = makeEffectOpsGateway({ model: options.effectModel, ledger: deck.consent })
      deck.register(gw)
      return gw
    }
    const cached = cliByKind.get(kind)
    if (cached !== undefined) return cached
    const gw = makeCliGateway(kind as never, { presets: allPresetsFor(kind) })
    cliByKind.set(kind, gw)
    deck.register(gw)
    return gw
  }

  const readBody = async (request: Request): Promise<Record<string, unknown>> => {
    const text = await request.text()
    if (text === "") return {}
    try { return JSON.parse(text) as Record<string, unknown> } catch { throw new Error("invalid JSON body") }
  }

  const param = (path: string, pattern: string): string | undefined => {
    const p = path.split("/").filter(Boolean)
    const pat = pattern.split("/").filter(Boolean)
    if (p.length !== pat.length) return undefined
    let captured: string | undefined
    for (let i = 0; i < pat.length; i++) {
      const token = pat[i]!
      if (token.startsWith(":")) captured = decodeURIComponent(p[i] ?? "")
      else if (token !== p[i]) return undefined
    }
    return captured
  }

  const kindOf = (sessionId: string): string | undefined =>
    deck.sessions().find((s) => s.sessionId === sessionId)?.kind

  let pageCache: string | undefined
  const pageHtml = async (): Promise<string> => {
    if (pageCache === undefined) pageCache = await Bun.file(import.meta.dir + "/../public/index.html").text()
    return pageCache
  }

  const router = async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    const { pathname, searchParams } = url
    try {
      if (pathname === "/" || pathname === "/index.html") return html(await pageHtml())
      if (pathname === "/api/deck" && request.method === "GET") {
        const sessions = deck.sessions()
        const pending = deck.consent.pending()
        const mapping = [...deck.consent.mapping()].map(([sessionId, list]) => ({
          sessionId,
          entries: list.length,
          pending: list.filter((e) => e.decision === "pending").length,
          allowed: list.filter((e) => e.decision === "allow").length,
          denied: list.filter((e) => e.decision === "deny").length
        }))
        return json({
          kinds: [...deck.kinds()], launchers, sessions, pending, mapping,
          samples: CONFIG_SAMPLES
        })
      }
      if (pathname === "/api/session" && request.method === "POST") {
        const body = await readBody(request)
        const kind = typeof body.kind === "string" ? body.kind : "demo"
        const knownKinds = new Set(["custom", "demo", "effect", "effect-ops", "claude-cc", ...Object.keys(builtinCliPresets), ...dynamicPresets.keys()])
        if (!knownKinds.has(kind) && deck.get(kind) === undefined) {
          return json({ ok: false, detail: "unknown agent kind: " + kind + " (register a preset via POST /api/presets or use custom)" }, 404)
        }
        const rawConfig = typeof body.config === "object" && body.config !== null ? body.config : {}
        const config = normalizeConfig(kind as never, rawConfig)
        const wantedId = typeof body.sessionId === "string" ? body.sessionId : undefined
        if (wantedId !== undefined && deck.sessions().some((s) => s.sessionId === wantedId)) {
          return json({ ok: false, detail: "session already open: " + wantedId }, 409)
        }
        const gateway = gatewayFor(kind)
        const opened = await gateway.open({
          sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
          prompt: typeof body.prompt === "string" ? body.prompt : undefined,
          config
        })
        const auto = config.consent?.autoApproveTools
        const mode = config.consent?.defaultDecision as "ask" | "allow" | "deny" | undefined
        if (auto !== undefined && auto.length > 0) {
          sessionPolicy.set(opened.sessionId, { auto: new Set(auto), mode: mode ?? "ask" })
        } else if (mode !== undefined && mode !== "ask") {
          sessionPolicy.set(opened.sessionId, { auto: new Set<string>(), mode })
        }
        return json({ ok: true, session: opened })
      }
      if (pathname === "/api/presets" && request.method === "GET") {
        const presets = [
          ...Object.entries(builtinCliPresets).map(([kind, p]) => ({ kind, file: p.file, builtin: true })),
          ...[...dynamicPresets.entries()].map(([kind, p]) => ({ kind, file: p.file, args: [...p.args], builtin: false }))
        ]
        return json({ ok: true, presets })
      }
      if (pathname === "/api/presets" && request.method === "POST") {
        const body = await readBody(request)
        const kind = typeof body.kind === "string" ? body.kind : undefined
        const file = typeof body.file === "string" ? body.file : undefined
        const args = Array.isArray(body.args) ? body.args.map(String) : []
        if (kind === undefined || file === undefined || kind.length === 0) return json({ ok: false, detail: "kind and file required" }, 400)
        if (builtinCliPresets[kind] !== undefined || kind === "custom" || kind === "demo" || kind === "effect" || kind === "claude-cc" || kind === "effect-ops") {
          return json({ ok: false, detail: "kind already taken: " + kind }, 409)
        }
        dynamicPresets.set(kind, { file, args })
        return json({ ok: true, kind, file, args })
      }
      if (pathname === "/api/launchers" && request.method === "GET") return json({ ok: true, launchers })
      if (pathname === "/api/launchers" && request.method === "POST") {
        const body = await readBody(request)
        const kind = typeof body.kind === "string" ? body.kind : undefined
        const label = typeof body.label === "string" ? body.label : undefined
        if (kind === undefined || label === undefined || kind.length === 0 || label.length === 0) return json({ ok: false, detail: "kind and label required" }, 400)
        const cfg = typeof body.config === "object" && body.config !== null ? body.config : undefined
        seedLauncher(kind, label, cfg)
        persistLaunchers()
        return json({ ok: true, launchers })
      }
      const launcherLabel = param(pathname, "/api/launchers/:label")
      if (launcherLabel !== undefined && request.method === "DELETE") {
        const kind = searchParams.get("kind")
        const idx = launchers.findIndex((l) => l.label === launcherLabel && (kind === null || l.kind === kind))
        if (idx === -1) return json({ ok: false, detail: "launcher not found" }, 404)
        const removed = launchers.splice(idx, 1)[0]!
        persistLaunchers()
        return json({ ok: true, removed })
      }
      if (pathname === "/api/config/samples" && request.method === "GET") return json({ ok: true, samples: CONFIG_SAMPLES })
      if (pathname === "/api/consent" && request.method === "GET") {
        return json({ ok: true, entries: deck.consent.entries() })
      }
      if (pathname === "/api/sessions/close-all" && request.method === "POST") {
        const sessions = deck.sessions()
        let closed = 0
        for (const s of sessions) {
          const gw = deck.get(s.kind)
          if (gw !== undefined) { await gw.close(s.sessionId); sessionPolicy.delete(s.sessionId); closed++ }
        }
        return json({ ok: true, closed })
      }
      const historyId = param(pathname, "/api/session/:id/history")
      if (historyId !== undefined && request.method === "GET") {
        const kind = kindOf(historyId)
        const gateway = kind === undefined ? undefined : deck.get(kind)
        const turns = gateway?.history !== undefined
          ? await Promise.resolve(gateway.history(historyId))
          : []
        const consent = (deck.consent.mapping().get(historyId) ?? []).slice().reverse()
        return json({ ok: true, sessionId: historyId, turns, consent })
      }
      const sendId = param(pathname, "/api/session/:id/send")
      if (sendId !== undefined && request.method === "POST") {
        const body = await readBody(request)
        const kind = kindOf(sendId)
        const gateway = kind === undefined ? undefined : deck.get(kind)
        if (gateway === undefined) return json({ ok: false, detail: "unknown session" }, 404)
        const session = deck.sessions().find((s) => s.sessionId === sendId)
        if (session?.status === "running") return json({ ok: false, detail: "session busy: " + sendId }, 409)
        const text = typeof body.text === "string" ? body.text : ""
        const out = await gateway.send(sendId, text)
        if (!out.ok && out.awaiting !== undefined && out.awaiting.length > 0) lastTurn.set(sendId, text)
        return out.ok
          ? json({ ok: true, text: out.text })
          : json({ ok: false, detail: out.detail, ...(out.awaiting !== undefined ? { awaiting: out.awaiting } : {}) }, 422)
      }
      const retryId = param(pathname, "/api/session/:id/retry")
      if (retryId !== undefined && request.method === "POST") {
        const text = lastTurn.get(retryId)
        if (text === undefined) return json({ ok: false, detail: "no pending turn to retry" }, 404)
        const kind = kindOf(retryId)
        const gateway = kind === undefined ? undefined : deck.get(kind)
        if (gateway === undefined) return json({ ok: false, detail: "unknown session" }, 404)
        const session = deck.sessions().find((s) => s.sessionId === retryId)
        if (session?.status === "running") return json({ ok: false, detail: "session busy: " + retryId }, 409)
        const out = await gateway.send(retryId, text)
        if (!out.ok && out.awaiting !== undefined && out.awaiting.length > 0) lastTurn.set(retryId, text)
        return out.ok
          ? json({ ok: true, text: out.text, retried: true })
          : json({ ok: false, detail: out.detail, ...(out.awaiting !== undefined ? { awaiting: out.awaiting } : {}) }, 422)
      }
      const closeId = param(pathname, "/api/session/:id/close")
      if (closeId !== undefined && request.method === "POST") {
        const kind = kindOf(closeId)
        const gateway = kind === undefined ? undefined : deck.get(kind)
        if (gateway !== undefined) await gateway.close(closeId)
        sessionPolicy.delete(closeId)
        return json({ ok: true })
      }
      if (pathname === "/api/consent/bulk" && request.method === "POST") {
        const body = await readBody(request)
        const allow = body.allow === true
        const pending = deck.consent.pending()
        let decided = 0
        for (const p of pending) if (deck.consent.resolve(p.callId, allow, "operator")) decided++
        return json({ ok: true, decided })
      }
      const callId = param(pathname, "/api/consent/:callId")
      if (callId !== undefined && request.method === "POST") {
        const body = await readBody(request)
        const allow = body.allow === true
        const done = deck.consent.resolve(callId, allow, "operator")
        return done ? json({ ok: true, allow }) : json({ ok: false, detail: "unknown or already decided call id" }, 404)
      }
      if (pathname === "/api/config/preview" && request.method === "GET") {
        const kind = searchParams.get("kind") ?? "claude-code"
        const rawText = searchParams.get("raw")
        let raw: unknown = {}
        if (rawText !== null) { try { raw = JSON.parse(rawText) } catch { return json({ ok: false, detail: "raw must be JSON" }, 400) } }
        const unified = normalizeConfig(kind as never, raw)
        const invocation = cliInvocableKinds().includes(kind) ? cliInvocation(unified, "<prompt>", allPresetsFor(kind)) : null
        return json({ ok: true, kind, unified, invocation })
      }
      return json({ ok: false, detail: "not found " + request.method + " " + pathname }, 404)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      return json({ ok: false, detail }, 500)
    }
  }

  const hostname = options.host ?? "127.0.0.1"
  const server = Bun.serve({ hostname, port: options.port ?? 0, fetch: router })
  const baseHost = hostname === "0.0.0.0" || hostname === "::" ? "127.0.0.1" : hostname
  return { server, deck, base: "http://" + baseHost + ":" + server.port }
}

if (import.meta.main) {
  const port = Number(process.env.DECK_PORT ?? "4851")
  const { server } = startDeckServer({ host: process.env.DECK_HOST, port })
  console.log("deckconsole listening on http://127.0.0.1:" + server.port)
}
