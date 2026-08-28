import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { existsSync } from "node:fs"
import { AgentContext, ClaudeCode, Harness, Op, Until, type Binding } from "../src/index.js"

describe("Claude Code isolation", () => {
  test("uses a temporary home, disables builtins, injects ops and skills", async () => {
    let home = ""
    let observed: any
    let prepared: any
    const nativeHooks = { PreToolUse: [] } as any
    const fakeQuery = (async function* (params: any) {
      observed = params.options
      home = params.options.env.CLAUDE_CONFIG_DIR
      expect(existsSync(`${home}/skills/reviewer-skill/SKILL.md`)).toBe(true)
      yield { type: "result", subtype: "success", result: "ok" }
    }) as any

    const Lookup = Op.read({
      name: "docs.lookup",
      description: "Lookup docs",
      input: Schema.Struct({ query: Schema.String }),
      output: Schema.String,
      execute: ({ query }) => Effect.succeed(query)
    })
    const Docs: Binding<any> = { uri: "ea://test/service/docs", ops: [Lookup] }

    const driver = Harness.withHooks(ClaudeCode.make({
      query: fakeQuery,
      claudeCodeHooks: nativeHooks,
      skillPaths: ["test/fixtures/reviewer-skill"],
      insecureTls: true
    }), Harness.hook("prepared", (event) => Effect.sync(() => {
      if (event._tag === "DriverPrepared") prepared = event.details
    })))
    const answer = await Effect.runPromise(driver.run({
      context: AgentContext.raw("hello"),
      until: Until.stop,
      access: [{ binding: Docs, write: false }]
    }))

    expect(answer).toBe("ok")
    expect(observed.tools).toEqual([])
    expect(observed.hooks).toBe(nativeHooks)
    expect(observed.skills).toBe("all")
    expect(observed.mcpServers.effect_agent).toBeDefined()
    expect(observed.allowedTools).toContain("mcp__effect_agent__docs_lookup")
    expect(prepared.temporaryClaudeHome).toBe(true)
    expect(prepared.cwd).toBe(process.cwd())
    expect(prepared.injectedOps).toEqual([{ op: "docs.lookup", claudeTool: "mcp__effect_agent__docs_lookup" }])
    expect(prepared.authentication.apiKeyConfigured).toBe(Boolean(process.env.ANTHROPIC_API_KEY))
    expect(prepared.insecureTls).toBe(true)
    expect(observed.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe("0")
    expect(existsSync(home)).toBe(false)
  })
})

describe("Claude Code global insecureTls", () => {
  test("top-level [insecureTls] defaults agents unless they override it", async () => {
    const makeObserved = async (name: string) => {
      let observed: any
      const fakeQuery = (async function* (params: any) {
        observed = params.options
        yield { type: "result", subtype: "success", result: "ok" }
      }) as any
      const driver = await Effect.runPromise(ClaudeCode.configured({
        path: "test/fixtures/insecure-tls.toml",
        envFile: false,
        env: { TEST_ANTHROPIC_KEY: "secret" },
        name,
        provider: "claude",
        overrides: { query: fakeQuery }
      }))
      await Effect.runPromise(driver.run({
        context: AgentContext.raw("hello"),
        until: Until.stop,
        access: []
      }))
      return observed
    }

    const inherited = await makeObserved("claudeCode")
    expect(inherited.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe("0")

    const overridden = await makeObserved("codexOnly")
    expect(overridden.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined()
  })
})
