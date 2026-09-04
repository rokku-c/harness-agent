/**
 * agentdeck - middle-abstraction control plane: config map (ask 3),
 * consent map (ask 2), flow control + registry (ask 1). All model-free:
 * effect adapter runs a scripted Model, CLI adapter runs a fake executable.
 */
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import type { Model } from "@effect-agent/builtin"
import { writeFileSync, chmodSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { normalizeConfig, makeConsentLedger, effectGateway, makeCliGateway, makeClaudeSdkGateway, makeEffectOpsGateway, makeDemoGateway, cliInvocation, AgentDeck, type SessionGateway } from "../src/index.ts"
import { cliPresets } from "../src/adapters/cli.ts"

describe("agentdeck config map (ask 3)", () => {
  test("any agent raw config normalizes to one unified shape; extras stay lossless", () => {
    const raw = {
      model: "claude-sonnet", cwd: "/tmp/ws", env: { AGENT_A: "1" },
      permissionMode: "bypassPermissions", allowedTools: ["Read", "Edit"],
      turnTimeoutMs: 5000, ownFlag: { deep: true }
    }
    const u = normalizeConfig("claude-code", raw)
    expect(u.kind).toBe("claude-code")
    expect(u.model).toBe("claude-sonnet")
    expect(u.cwd).toBe("/tmp/ws")
    expect(u.env?.get("AGENT_A")).toBe("1")
    expect(u.consent?.autoApproveTools).toEqual(["Read", "Edit"])
    expect(u.extra?.permissionMode).toBe("bypassPermissions")
    expect(u.extra?.ownFlag).toEqual({ deep: true })
  })
  test("kind dialects map their own declared model field into the unified model", () => {
    const codex = normalizeConfig("codex", { codexModel: "o4", sandbox: "read-only" })
    expect(codex.model).toBe("o4")
    expect(codex.extra?.sandbox).toBe("read-only")
    const gemini = normalizeConfig("gemini", { geminiModel: "gemini-2.5" })
    expect(gemini.model).toBe("gemini-2.5")
  })
  test("cli presets exist for the mainstream kinds and are overridable", () => {
    expect(cliPresets["claude-code"]?.file).toBe("claude")
    expect(cliPresets.codex?.file).toBe("codex")
    expect(cliPresets.gemini?.file).toBe("gemini")
    expect(cliPresets.pi?.file).toBe("pi")
    const custom = normalizeConfig("custom", { command: "myagent", args: ["-m", "fast"] })
    expect(custom.command).toBe("myagent")
    expect(custom.args).toEqual(["-m", "fast"])
  })
  test("cliInvocation renders the exact spawn plan from the unified config", () => {
    const cc = cliInvocation(normalizeConfig("claude-code", {}), "go")
    expect(cc.file).toBe("claude")
    expect(cc.argv).toEqual(["-p", "go"])
    const over = cliInvocation(normalizeConfig("custom", { command: "sh", args: ["-x"] }), "go")
    expect(over.file).toBe("sh")
    expect(over.argv).toEqual(["-x", "go"])
  })
})

describe("agentdeck consent map (ask 2)", () => {
  test("asks are recorded per session, auto-allowed tools never wait, resolves stamp the decision", () => {
    const ledger = makeConsentLedger({ autoApproveTools: ["note_write"] })
    ledger.ask("s1", "read", { path: "/x" })
    const autoId = ledger.ask("s1", "note_write", { text: "ok" })
    ledger.ask("s2", "write", { path: "/y" })
    expect(ledger.pending().map((p) => p.sessionId)).toEqual(["s1", "s2"])
    expect(ledger.pending().map((p) => p.tool)).toEqual(["read", "write"])
    // auto-allowed: never pending, recorded as allow by "auto"
    expect(ledger.entries("s1").find((e) => e.callId === autoId)?.decision).toBe("allow")
    const first = ledger.pending()[0]!
    expect(ledger.resolve(first.callId, true)).toBe(true)
    expect(ledger.resolve(first.callId, false)).toBe(false) // no double resolve
    const denied = ledger.pending()[0]!
    expect(ledger.resolve(denied.callId, false, "operator")).toBe(true)
    expect(ledger.mapping().get("s2")?.some((e) => e.decision === "deny" && e.by === "operator")).toBe(true)
    expect(ledger.pending().length).toBe(0)
    expect(ledger.resolve("missing", true)).toBe(false)
  })
})

const scriptedModel = (): Model => {
  const model: any = {
    generate: (_s: string, messages: ReadonlyArray<unknown>) =>
      Effect.gen(function* () {
        const last = [...messages].reverse().find((m: any) => m.role === "user")
        const content = String(last?.content ?? "")
        const line = content.split("\n").find((l: string) => l.startsWith("PLZ ")) ?? content
        return { text: "echo:" + line.replace(/^PLZ /, ""), toolCalls: [] }
      })
  }
  return model as Model
}

describe("agentdeck flow control (ask 1)", () => {
  test("effect gateway: open -> send -> close drives the in-proc runtime", async () => {
    const gw = effectGateway({ model: () => scriptedModel() })
    const opened = await gw.open({ sessionId: "e1", prompt: "seed", config: normalizeConfig("effect", {}) })
    expect(opened.status).toBe("idle")
    const out = await gw.send("e1", "PLZ hello deck")
    expect(out.ok).toBe(true)
    expect(out.text).toBe("echo:hello deck")
    expect((await gw.status("e1")).status).toBe("idle")
    expect(gw.sessions().length).toBe(1)
    await gw.close("e1")
    expect(gw.sessions().length).toBe(0)
  })
  test("cli gateway runs a fake executable and maps config to argv", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-cli-"))
    const script = join(dir, "fake-agent.sh")
    writeFileSync(script, "#!/bin/sh\necho FAKE-RESPONSE:$1\n")
    chmodSync(script, 0o755)
    try {
      const gw = makeCliGateway("custom")
      const opened = await gw.open({ sessionId: "cli1", config: normalizeConfig("custom", { command: "sh", args: [script], cwd: dir, turnTimeoutMs: 8000 }) })
      expect(opened.status).toBe("idle")
      const out = await gw.send("cli1", "go")
      expect(out.ok).toBe(true)
      expect(out.text).toBe("FAKE-RESPONSE:go")
      expect(gw.sessions().length).toBe(1)
      await gw.close("cli1")
      expect(gw.sessions().length).toBe(0)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
  test("registry aggregates sessions across gateways and shares the ledger", async () => {
    const deck = new AgentDeck(makeConsentLedger())
    deck.register(effectGateway({ model: () => scriptedModel() }))
    deck.register(makeCliGateway("custom"))
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-reg-"))
    const script = join(dir, "fake.sh")
    writeFileSync(script, "#!/bin/sh\necho REG:$1\n")
    chmodSync(script, 0o755)
    try {
      await deck.get("effect")!.open({ sessionId: "r-e", config: normalizeConfig("effect", {}) })
      await deck.get("custom")!.open({ sessionId: "r-c", config: normalizeConfig("custom", { command: "sh", args: [script], cwd: dir }) })
      expect(deck.sessions().map((s) => s.sessionId).sort()).toEqual(["r-c", "r-e"])
      expect([...deck.kinds()].sort()).toEqual(["custom", "effect"])
      const out = await deck.get("custom")!.send("r-c", "hi")
      expect(out.ok && out.text).toBe("REG:hi")
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})


describe("agentdeck claude-cc (in-proc SDK variant of claude-code)", () => {
  const stubQuery = (script: Array<any>) => {
    const calls: Array<{ prompt: string; options?: any }> = []
    const query = ((args: { prompt: string; options?: any }) => {
      calls.push({ prompt: args.prompt, options: args.options })
      return (async function* () { for (const message of script) yield message })() as any
    }) as any
    return { query, calls }
  }
  const msg = (m: any) => m
  const sdkMessages = () => [
    msg({ type: "assistant", message: { content: [{ type: "text", text: "let me check" }] } }),
    msg({ type: "result", subtype: "success", result: "final sdk answer" })
  ]

  test("flow + unified config map onto the builtin ClaudeCode driver", async () => {
    const { query, calls } = stubQuery(sdkMessages())
    const gw = makeClaudeSdkGateway({ query })
    const opened = await gw.open({ sessionId: "cc-1", config: normalizeConfig("claude-cc", { model: "claude-x", cwd: "/w", turnTimeoutMs: 8000 }) })
    expect(opened.status).toBe("idle")
    const out = await gw.send("cc-1", "please summarize")
    expect(out.ok).toBe(true)
    expect(out.text).toBe("final sdk answer")
    expect(calls.length).toBe(1)
    expect(calls[0]!.prompt).toContain("please summarize")
    expect(gw.sessions().length).toBe(1)
    const h = gw.history ? gw.history("cc-1") : []
    expect(h.length).toBe(2)
    expect(h[1]!.role).toBe("agent")
    await gw.close("cc-1")
    expect(gw.sessions().length).toBe(0)
  })
})


describe("agentdeck flow control edge semantics (ask 1 contract)", () => {
  test("cli gateway aborts a turn on turnTimeoutMs and reports timeout detail", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-slow-"))
    const script = join(dir, "slow.sh")
    writeFileSync(script, "#!/bin/sh\nsleep 5\necho late\n")
    chmodSync(script, 0o755)
    try {
      const gw = makeCliGateway("custom")
      await gw.open({ sessionId: "slow-1", config: normalizeConfig("custom", { command: "sh", args: [script], cwd: dir, turnTimeoutMs: 250 }) })
      const started = Date.now()
      const out = await gw.send("slow-1", "go")
      expect(out.ok).toBe(false)
      expect(out.detail).toContain("timed out")
      expect(Date.now() - started).toBeLessThan(4000)
      expect((await gw.status("slow-1")).status).toBe("failed")
      await gw.close("slow-1")
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  test("gemini and pi raw dialects normalize their model + keep extras lossless", () => {
    const gem = normalizeConfig("gemini", { geminiModel: "gemini-2.5-flash", geminiProject: "p1", temperature: 0.7 })
    expect(gem.model).toBe("gemini-2.5-flash")
    expect(gem.extra?.geminiProject).toBe("p1")
    expect(gem.extra?.temperature).toBe(0.7)
    const pi = normalizeConfig("pi", { piModel: "pi-3", cwd: "/tmp", weird: [1, 2] })
    expect(pi.model).toBe("pi-3")
    expect(pi.extra?.weird).toEqual([1, 2])
  })

  test("defaultDecision deny survives normalization (ask 3 -> ask 2 wiring)", () => {
    const u = normalizeConfig("demo", { consent: { autoApproveTools: ["note_write"], defaultDecision: "deny" } })
    expect(u.consent?.defaultDecision).toBe("deny")
    expect(u.consent?.autoApproveTools).toEqual(["note_write"])
  })
})


describe("agentdeck effect-ops: consent decisions steer real op execution", () => {
  const opsModel = (): Model => {
    const model: any = {
      generate: (_s: string, messages: ReadonlyArray<unknown>) =>
        Effect.gen(function* () {
          const toolMsgs = [...messages].reverse().filter((m: any) => m.role === "tool")
          if (toolMsgs.length > 0) {
            const content = (toolMsgs[0] as any).content
            return { text: "op-result:" + JSON.stringify(content) }
          }
          const user = [...messages].reverse().find((m: any) => m.role === "user")
          const content = String((user as any)?.content ?? "write /tmp/x")
          const path = content.trim().split(/\s+/).pop() ?? "/tmp/x"
          return { toolCalls: [{ id: "w1", name: "write_file", input: { path } }] }
        })
    }
    return model as Model
  }

  test("first send raises an ask and awaits; approval then allows the real write", async () => {
    const ledger = makeConsentLedger()
    const gw = makeEffectOpsGateway({ model: opsModel, ledger })
    await gw.open({ sessionId: "eo-1", config: normalizeConfig("custom", {}) })
    const first = await gw.send("eo-1", "please write /tmp/deck-ops.txt")
    expect(first.ok).toBe(false)
    expect(first.awaiting?.length).toBe(1)
    const callId = first.awaiting![0]!
    expect(ledger.pending().some((p) => p.callId === callId && p.tool === "write_file")).toBe(true)
    // nothing executed yet
    const deckBefore = ledger.mapping().get("eo-1") ?? []
    expect(deckBefore.find((e) => e.callId === callId)?.decision).toBe("pending")
    // operator approves -> re-send executes for real
    expect(ledger.resolve(callId, true)).toBe(true)
    const second = await gw.send("eo-1", "please write /tmp/deck-ops.txt")
    expect(second.ok).toBe(true)
    expect(second.text).toContain("op-result")
    // the op really executed: the driver returned the op output JSON-encoded
    // inside a quoted string -> decode twice and check the write payload
    const literal = second.text.slice("op-result:".length)
    const payload = JSON.parse(JSON.parse(literal) as string) as { ok?: boolean; path?: string }
    expect(payload.ok).toBe(true)
    expect(payload.path).toBe("/tmp/deck-ops.txt")
    await gw.close("eo-1")
  })

  test("denial aborts the turn with a readable cause and no write", async () => {
    const ledger = makeConsentLedger()
    const gw = makeEffectOpsGateway({ model: opsModel, ledger })
    await gw.open({ sessionId: "eo-2", config: normalizeConfig("custom", {}) })
    const first = await gw.send("eo-2", "write /tmp/denied.txt")
    expect(first.ok).toBe(false)
    const callId = first.awaiting![0]!
    expect(ledger.resolve(callId, false)).toBe(true)
    const second = await gw.send("eo-2", "write /tmp/denied.txt")
    expect(second.ok).toBe(false)
    expect(second.detail).toContain("denied")
    await gw.close("eo-2")
  })
})


describe("agentdeck effect gateway keeps a real conversation across turns", () => {
  test("each send replays the seed + prior turns into the next driver context", async () => {
    const seen: Array<string> = []
    const makeModel = () => {
      const model: any = {
        generate: (_s: string, messages: ReadonlyArray<any>) =>
          Effect.gen(function* () {
            const ctx = [...messages].reverse().find((m: any) => m.role === "user")
            seen.push(String(ctx?.content ?? ""))
            return { text: "echo:" + String(ctx?.content ?? "").slice(0, 400) }
          })
      }
      return model as Model
    }
    const gw = effectGateway({ model: makeModel })
    await gw.open({ sessionId: "conv-1", config: normalizeConfig("effect", {}), prompt: "你是评审助手" })
    await gw.send("conv-1", "第一问")
    await gw.send("conv-1", "第二问")
    expect(seen.length).toBe(2)
    expect(seen[0]).toContain("你是评审助手")
    expect(seen[0]).toContain("第一问")
    expect(seen[1]).toContain("Prior turns")
    expect(seen[1]).toContain("第一问")
    expect(seen[1]).toContain("第二问")
    const history = await gw.history?.("conv-1")
    expect(history?.map((x) => x.role)).toEqual(["user", "agent", "user", "agent"])
    const contents = history?.map((x) => x.content) ?? []
    expect(contents[0]).toBe("第一问")
    expect(contents[1]).toContain("echo:")
    expect(contents[1]).toContain("你是评审助手")
    expect(contents[2]).toBe("第二问")
    expect(contents[3]).toContain("Prior turns")
    expect(contents[3]).toContain("第一问")
    expect(contents[3]).toContain("第二问")
    await gw.close("conv-1")
  })
})


describe("agentdeck cli transcript parity", () => {
  test("cli gateway records a transcript (user + agent turns) like other gateways", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-clih-"))
    const script = join(dir, "say.sh")
    writeFileSync(script, "#!/bin/sh\necho SAID:$1\n")
    chmodSync(script, 0o755)
    try {
      const gw = makeCliGateway("custom")
      await gw.open({ sessionId: "cli-h1", config: normalizeConfig("custom", { command: "sh", args: [script] }) })
      const out = await gw.send("cli-h1", "hello transcript")
      expect(out.ok).toBe(true)
      expect(out.text).toBe("SAID:hello transcript")
      const history = await gw.history?.("cli-h1")
      expect(history?.map((x) => x.role)).toEqual(["user", "agent"])
      expect(history?.[0]?.content).toBe("hello transcript")
      expect(history?.[1]?.content).toBe("SAID:hello transcript")
      await gw.close("cli-h1")
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})


describe("agentdeck cli presets track real CLI syntax", () => {
  test("gemini renders as positional one-shot (>=0.24 modern syntax)", () => {
    const plan = cliInvocation(normalizeConfig("gemini", { geminiModel: "x" }), "say hi")
    expect(plan.file).toBe("gemini")
    expect(plan.argv).toEqual(["say hi"])
  })
  test("codex renders exec with the prompt appended (sandbox/approval stay caller-side)", () => {
    const plan = cliInvocation(normalizeConfig("codex", {}), "do it")
    expect(plan.file).toBe("codex")
    expect(plan.argv).toEqual(["exec", "do it"])
  })
})


describe("agentdeck cli session close mid-turn", () => {
  test("closing a session mid-turn kills the child and reports closed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-clikill-"))
    const script = join(dir, "slow.sh")
    writeFileSync(script, "#!/bin/sh\nsleep 8\necho late\n")
    chmodSync(script, 0o755)
    try {
      const gw = makeCliGateway("custom")
      await gw.open({ sessionId: "kill-1", config: normalizeConfig("custom", { command: "sh", args: [script] }) })
      const started = Date.now()
      const sending = gw.send("kill-1", "go")
      await new Promise((r) => setTimeout(r, 200))
      await gw.close("kill-1")
      const out = await sending
      expect(out.ok).toBe(false)
      expect(out.detail).toContain("closed")
      expect(Date.now() - started).toBeLessThan(3000)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})


describe("agentdeck uniform SessionGateway surface (ask 1 contract)", () => {
  const echoModel = (): Model => {
    const model: any = {
      generate: (_s: string, messages: ReadonlyArray<any>) =>
        Effect.gen(function* () {
          const user = [...messages].reverse().find((m: any) => m.role === "user")
          const content = String((user as any)?.content ?? "")
          const m2 = content.match(/\\b(\w+)$/)
          return { text: m2 ? m2[1] : "ok" }
        })
    }
    return model as Model
  }
  const mkGateways = () => [
    { kind: "demo", gw: makeDemoGateway({}) },
    { kind: "effect", gw: effectGateway({ model: echoModel }) },
    { kind: "effect-ops", gw: makeEffectOpsGateway({ model: echoModel, ledger: makeConsentLedger() }) },
    { kind: "custom-cli", gw: makeCliGateway("custom", { presets: { custom: { file: "true", argv: () => [] } } }) }
  ] as Array<{ kind: string; gw: SessionGateway }>

  test("every adapter exposes the same lifecycle + transcript surface", async () => {
    for (const { kind, gw } of mkGateways()) {
      expect(typeof gw.open).toBe("function")
      expect(typeof gw.send).toBe("function")
      expect(typeof gw.close).toBe("function")
      expect(typeof gw.status).toBe("function")
      expect(typeof gw.sessions).toBe("function")
      const opened = await gw.open({ sessionId: "surf-" + kind, config: normalizeConfig("custom", {}) })
      expect(typeof opened.sessionId).toBe("string")
      expect(typeof opened.kind).toBe("string")
      expect(opened.status).toBe("idle")
      expect((await gw.status("surf-" + kind)).status).toBe("idle")
      expect(gw.sessions().length).toBe(1)
      const out = await gw.send("surf-" + kind, "say surf")
      expect(typeof out.ok).toBe("boolean")
      if (out.ok === false && kind === "effect-ops") expect(out.awaiting?.length).toBe(1)
      if (typeof gw.history === "function") {
        const turns = await gw.history("surf-" + kind)
        expect(Array.isArray(turns)).toBe(true)
      }
      await gw.close("surf-" + kind)
      expect(gw.sessions().length).toBe(0)
    }
  })
})

describe("agentdeck consent ledger edge semantics (review hardening)", () => {
  test("resolve is idempotent: second call returns false and never flips a settled decision", async () => {
    const ledger = makeConsentLedger()
    const cid = ledger.ask("s-1", "write", { path: "/a" })
    expect(ledger.resolve(cid, true)).toBe(true)
    expect(ledger.resolve(cid, false)).toBe(false)
    const entry = (ledger.mapping().get("s-1") ?? []).find((e) => e.callId === cid)
    expect(entry?.decision).toBe("allow")
    expect(entry?.by).toBe("operator")
    expect(ledger.pending().length).toBe(0)
  })
  test("mapping entries and per-session lists are not the live mutable arrays", async () => {
    const ledger = makeConsentLedger()
    ledger.ask("s-2", "read", {})
    const list = ledger.mapping().get("s-2")
    const before = list?.length ?? 0
    ledger.ask("s-2", "write", {})
    expect(ledger.mapping().get("s-2")?.length).toBe(before + 1)
    expect(list?.length).toBe(before)
  })
})

describe("agentdeck unified env shape", () => {
  test("raw env object normalizes into a Map with string values (CLI merge path)", () => {
    const u = normalizeConfig("codex", { env: { DECK_X: "1", PATH: "/usr/bin", N: 5 } })
    expect(u.env).toBeInstanceOf(Map)
    expect(u.env?.get("DECK_X")).toBe("1")
    expect(u.env?.get("N")).toBe("5")
    const plan = cliInvocation(normalizeConfig("custom", { command: "sh", args: ["-c", "env"], env: { DECK_Y: "2" } }), "p")
    expect(plan.file).toBe("sh")
  })
})

describe("agentdeck component-level single-flight (no server needed)", () => {
  test("cli gateway rejects a second send while a turn is running", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-busy-"))
    const script = join(dir, "slow.sh")
    writeFileSync(script, "#!/bin/sh\nsleep 2\necho LATE\n")
    chmodSync(script, 0o755)
    try {
      const gw = makeCliGateway("custom")
      await gw.open({ sessionId: "busy-c", config: normalizeConfig("custom", { command: "sh", args: [script] }) })
      const first = gw.send("busy-c", "go")
      await new Promise((r) => setTimeout(r, 150))
      const second = await gw.send("busy-c", "again")
      expect(second.ok).toBe(false)
      expect(second.detail).toContain("busy")
      const done = await first
      expect(done.ok).toBe(true)
      expect(done.text).toBe("LATE")
      await gw.close("busy-c")
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
  test("effect gateway rejects a second send while a turn is running", async () => {
    const model: any = { generate: () => Effect.gen(function* () { yield* Effect.sleep("200 millis"); return { text: "later" } }) }
    const gw = effectGateway({ model: () => model as Model })
    await gw.open({ sessionId: "busy-e", config: normalizeConfig("effect", {}) })
    const first = gw.send("busy-e", "one")
    await new Promise((r) => setTimeout(r, 40))
    const second = await gw.send("busy-e", "two")
    expect(second.ok).toBe(false)
    expect(second.detail).toContain("busy")
    expect((await first).ok).toBe(true)
    await gw.close("busy-e")
  })
})
