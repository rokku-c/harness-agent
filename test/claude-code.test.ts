import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { existsSync } from "node:fs"
import { Context, ClaudeCode, Harness, Op, runDriver, Until, type Binding, type SubagentProgram } from "../src/index.js"

/** Compatibility shim: old driver.run({ context, until, access, subagents }) via the new runDriver. */
const run = (driver: any, args: { context: any; until: any; access?: any; subagents?: any }) => {
  let ctx = args.context.withUntil(args.until).withAccess(args.access ?? [])
  if (args.subagents?.length) ctx = ctx.withSubagents(args.subagents)
  return runDriver(driver, ctx)
}

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
    const Docs: Binding = { uri: "ea://test/service/docs", ops: [Lookup] }

    const driver = Harness.withHooks(ClaudeCode.make({
      query: fakeQuery,
      claudeCodeHooks: nativeHooks,
      skillPaths: ["test/fixtures/reviewer-skill"],
      insecureTls: true
    }), Harness.hook("prepared", (event) => Effect.sync(() => {
      if (event._tag === "DriverPrepared") prepared = event.details
    })))
    const answer = await Effect.runPromise(runDriver(driver,
      Context.with({ messages: [{ role: "user", content: "hello" }] }).withUntil(Until.stop).withAccess([{ binding: Docs, write: false }])))

    expect(answer.output).toBe("ok")
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

  test("injects Context always text as native systemPrompt", async () => {
    let observed: any
    const fakeQuery = (async function* (params: any) {
      observed = params.options
      yield { type: "result", subtype: "success", result: "ok" }
    }) as any
    const driver = ClaudeCode.make({ query: fakeQuery })
    await Effect.runPromise(runDriver(driver,
      Context.with({ always: [{ _tag: "Always", text: "You are a review specialist." }], messages: [{ role: "user", content: "hello" }] }).withUntil(Until.stop)))
    expect(observed.systemPrompt).toBe("You are a review specialist.")
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
      await Effect.runPromise(runDriver(driver, Context.with({ messages: [{ role: "user", content: "hello" }] }).withUntil(Until.stop)))
      return observed
    }

    const inherited = await makeObserved("claudeCode")
    expect(inherited.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe("0")

    const overridden = await makeObserved("codexOnly")
    expect(overridden.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined()
  })
})

describe("Claude Code runtime subagents", () => {
  const makeFakeQuery = (observed: { value?: any }) => (async function* (params: any) {
    observed.value = params.options
    yield { type: "result", subtype: "success", result: "ok" }
  }) as any

  test("injects a delegate MCP tool per declared subagent", async () => {
    const observed: { value?: any } = {}
    const driver = ClaudeCode.make({ query: makeFakeQuery(observed) })
    const subagent: SubagentProgram = {
      id: "reviewer",
      until: Until.stop,
      access: [],
      context: (goal) => Context.with({ messages: [{ role: "user", content: `审查：${goal}` }] })
    }
    await Effect.runPromise(run(driver, {
      context: Context.with({ messages: [{ role: "user", content: "hello" }] }),
      until: Until.stop,
      access: [],
      subagents: [subagent]
    }))

    // The delegate tool is registered on the effect_agent MCP server instance.
    const registered = observed.value!.mcpServers.effect_agent.instance._registeredTools
    const delegate = registered.effect_agent_subagent_reviewer
    expect(delegate).toBeDefined()
    expect(delegate.description).toContain("reviewer")
    // And allowedTools grants it.
    expect(observed.value!.allowedTools).toContain("mcp__effect_agent__effect_agent_subagent_reviewer")
  })

  test("delegate tool runs the child subagent and returns its output", async () => {
    const observed: { value?: any } = {}
    const driver = ClaudeCode.make({ query: makeFakeQuery(observed) })
    const subagent: SubagentProgram = {
      id: "reviewer",
      until: Until.stop,
      access: [],
      context: (goal) => Context.with({ messages: [{ role: "user", content: `审查：${goal}` }] })
    }
    await Effect.runPromise(run(driver, {
      context: Context.with({ messages: [{ role: "user", content: "hello" }] }),
      until: Until.stop,
      access: [],
      subagents: [subagent]
    }))

    // Invoke the delegate tool handler directly and confirm it returns a tool result.
    const registered = observed.value!.mcpServers.effect_agent.instance._registeredTools
    const result = await registered.effect_agent_subagent_reviewer.handler({ goal: "检查 auth" })
    expect(result.content[0].text).toBe(JSON.stringify("ok"))
  })

  test("does not inject delegate tools when no subagents declared", async () => {
    const observed: { value?: any } = {}
    const driver = ClaudeCode.make({ query: makeFakeQuery(observed) })
    await Effect.runPromise(run(driver, {
      context: Context.with({ messages: [{ role: "user", content: "hello" }] }),
      until: Until.stop,
      access: []
    }))

    // With no ops and no subagents, no effect_agent MCP server is created at all.
    expect(observed.value!.mcpServers).toBeUndefined()
  })
})

describe("Claude Code configurable tool naming", () => {
  const Lookup = Op.read({
    name: "docs.lookup",
    description: "Lookup docs",
    input: Schema.Struct({ query: Schema.String }),
    output: Schema.String,
    execute: ({ query }) => Effect.succeed(query)
  })
  const Docs: Binding = { uri: "ea://test/service/docs", ops: [Lookup] }

  test("applies toolPrefix to injected tool names", async () => {
    const observed: { value?: any } = {}
    const fakeQuery = (async function* (params: any) {
      observed.value = params.options
      yield { type: "result", subtype: "success", result: "ok" }
    }) as any
    const driver = ClaudeCode.make({ query: fakeQuery, toolPrefix: "ea_" })
    await Effect.runPromise(run(driver, {
      context: Context.with({ messages: [{ role: "user", content: "hello" }] }),
      until: Until.stop,
      access: [{ binding: Docs, write: false }]
    }))

    expect(observed.value!.mcpServers.effect_agent).toBeDefined()
    // tool name gets the prefix; allowedName is mcp__<channel>__<prefixed name>
    expect(observed.value!.allowedTools).toContain("mcp__effect_agent__ea_docs_lookup")
  })

  test("honors custom mcpChannel", async () => {
    const observed: { value?: any } = {}
    const fakeQuery = (async function* (params: any) {
      observed.value = params.options
      yield { type: "result", subtype: "success", result: "ok" }
    }) as any
    const driver = ClaudeCode.make({ query: fakeQuery, mcpChannel: "my_agent" })
    await Effect.runPromise(run(driver, {
      context: Context.with({ messages: [{ role: "user", content: "hello" }] }),
      until: Until.stop,
      access: [{ binding: Docs, write: false }]
    }))

    expect(observed.value!.mcpServers.my_agent).toBeDefined()
    expect(observed.value!.allowedTools).toContain("mcp__my_agent__docs_lookup")
  })

  test("combines toolPrefix and mcpChannel", async () => {
    const observed: { value?: any } = {}
    const fakeQuery = (async function* (params: any) {
      observed.value = params.options
      yield { type: "result", subtype: "success", result: "ok" }
    }) as any
    const driver = ClaudeCode.make({ query: fakeQuery, toolPrefix: "x_", mcpChannel: "c" })
    await Effect.runPromise(run(driver, {
      context: Context.with({ messages: [{ role: "user", content: "hello" }] }),
      until: Until.stop,
      access: [{ binding: Docs, write: false }]
    }))

    expect(observed.value!.mcpServers.c).toBeDefined()
    expect(observed.value!.allowedTools).toContain("mcp__c__x_docs_lookup")
  })
})
