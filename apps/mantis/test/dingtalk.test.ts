/**
 * MantisHost + channels on effect-agent - the dingtalk wiring:
 *   1. one session per conversation, history materialized on later turns
 *   2. histories are isolated between conversations
 *   3. replies flow back to the channel
 *   4. dws poll parsing: own messages dropped, records normalized
 *   5. robot stream message normalization
 */
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import type { Model, WireMessage, WireTool } from "@effect-agent/builtin"
import { makeMantis } from "../src/agent.ts"
import { MantisHost } from "../src/hosts/dingtalk/host.ts"
import { MockChannel } from "../src/hosts/dingtalk/channels/mock.ts"
import { makeDwsChannel, parseDwsList } from "../src/hosts/dingtalk/channels/dws.ts"
import { toIncomingRobot } from "../src/hosts/dingtalk/channels/robot.ts"
import { ManualGate, type PendingApproval } from "@effect-agent/gate"
import { makeLogger } from "@effect-agent/logger"
import type { IncomingMessage } from "../src/hosts/dingtalk/messages.ts"

type Script = Array<{ text: string; toolCalls?: Array<{ id: string; name: string; input: unknown }> }>

const scriptedModel = (script: Script): Model & { calls: number; lastThread?: ReadonlyArray<WireMessage> } => {
  const queue = [...script]
  const model: any = {
    calls: 0,
    generate: (_s: string, messages: ReadonlyArray<WireMessage>, _tools: ReadonlyArray<WireTool>) => {
      model.calls++
      model.lastThread = messages
      return Effect.succeed(queue.shift() ?? { text: JSON.stringify({ reply: "done", tone: "plain", asksConfirmation: false }), toolCalls: [] })
    }
  }
  return model
}

const msg = (partial: Partial<IncomingMessage>): IncomingMessage => ({
  id: "m1",
  text: "hello",
  conversationId: "cid-a",
  conversationType: "single",
  senderId: "u1",
  addressed: true,
  ts: 1000,
  ...partial
})

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const waitFor = async (condition: () => Promise<boolean> | boolean, timeoutMs = 3_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await condition()) return
    await sleep(10)
  }
  throw new Error("waitFor timed out")
}

const finalJson = (reply: string) => ({
  text: JSON.stringify({ reply, tone: "plain", asksConfirmation: false }),
  toolCalls: [] as Array<never>
})

const mantisNotes = (host: MantisHost, conversationId: string, query: string) =>
  host.session(conversationId).notes.search(query).length

const threadText = (thread?: ReadonlyArray<WireMessage>) =>
  (thread ?? []).filter((m) => m.role === "user").map((m) => m.content).join("\n---\n")

describe("MantisHost: conversations", () => {
  test("second message in a conversation sees the first turn in context", async () => {
    const model = scriptedModel([finalJson("first reply"), finalJson("second reply")])
    const host = new MantisHost({ model })
    const channel = new MockChannel()
    const running = host.run(channel)
    try {
      await channel.push(msg({ id: "m1", text: "remember: the sky is blue" }))
      const second = await channel.push(msg({ id: "m2", text: "what color is the sky?" }))
      expect(second?.text).toBe("second reply")
      // the history binding materialized the first turn into the second context
      const thread = threadText(model.lastThread)
      expect(thread).toContain("the sky is blue")
      expect(thread).toContain("Conversation history")
      expect(channel.sent).toHaveLength(2)
    } finally {
      void running // listen() never settles; leave it for process exit
    }
  })

  test("conversations are isolated: no history leaks across sessions", async () => {
    const model = scriptedModel([finalJson("reply-a"), finalJson("reply-b")])
    const host = new MantisHost({ model })
    const channel = new MockChannel()
    const running = host.run(channel)
    try {
      await channel.push(msg({ id: "m1", conversationId: "cid-a", text: "secret A" }))
      await channel.push(msg({ id: "m2", conversationId: "cid-b", text: "hello B" }))
      const thread = threadText(model.lastThread)
      expect(thread).not.toContain("secret A") // conversation B has no A history
    } finally {
      void running
    }
  })

  test("mantis sessions are per conversation (workspace isolated)", async () => {
    const model = scriptedModel([finalJson("ok")])
    const host = new MantisHost({ model })
    const sessionA = host.session("cid-a")
    const sessionB = host.session("cid-b")
    expect(sessionA).not.toBe(sessionB)
    expect(host.session("cid-a")).toBe(sessionA) // reused
  })
})

describe("dws channel: poll parsing", () => {
  const source = { kind: "group", id: "cid-g1" } as const
  test("parses a list payload and drops the user's own messages", () => {
    const json = JSON.stringify({
      messages: [
        { msgId: "a1", text: { content: "hi bot" }, senderId: "u2", senderNick: "Bob", createTime: 1700000000000, isInAtList: true },
        { msgId: "a2", text: { content: "ignored" }, senderId: "me1", createTime: 1700000000001 }
      ]
    })
    const parsed = parseDwsList(json, source, "me1")
    expect(parsed).toHaveLength(1)
    expect(parsed[0]!.text).toBe("hi bot")
    expect(parsed[0]!.conversationType).toBe("group")
    expect(parsed[0]!.addressed).toBe(true)
  })

  test("channel replies into the source with chat message send", async () => {
    const calls: Array<string[]> = []
    let listed = false
    const runner = {
      run: async (args: ReadonlyArray<string>) => {
        calls.push([...args])
        if (args.includes("list") && !listed) {
          listed = true
          return JSON.stringify({
            messages: [
              { msgId: "m9", text: { content: "hi" }, senderId: "u2", senderNick: "Bob", createTime: Date.now() }
            ]
          })
        }
        return JSON.stringify({ messages: [] })
      }
    }
    const channel = makeDwsChannel({ source, runner, pollIntervalMs: 5 })
    const deliver = async (m: IncomingMessage) => ({ text: "ack " + m.text, tone: "plain" as const })
    void channel.listen(deliver)
    const start = Date.now()
    while (!calls.some((args) => args.includes("send")) && Date.now() - start < 2000) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    const send = calls.find((args) => args.includes("send"))
    expect(send).toBeDefined()
    expect(send!.slice(0, 6)).toEqual(["chat", "message", "send", "--group", "cid-g1", "--text"])
  })
})

describe("robot channel: stream normalization", () => {
  test("normalizes a robot message with its webhook fields", () => {
    const raw = {
      msgId: "r1",
      conversationId: "cid-r",
      conversationType: "2",
      senderStaffId: "staff-9",
      senderNick: "Alice",
      isInAtList: true,
      sessionWebhook: "https://hook.dingtalk.com/x",
      text: { content: "@bot 明天天气" }
    }
    const message = toIncomingRobot(raw)
    expect(message?.text).toContain("明天天气")
    expect(message?.conversationId).toBe("cid-r")
    expect(message?.conversationType).toBe("group")
    expect(message?.addressed).toBe(true)
  })

  test("drops empty/non-addressable robot messages", () => {
    expect(toIncomingRobot({})).toBeUndefined()
    expect(toIncomingRobot({ msgId: "x", conversationId: "c", conversationType: "2", text: { content: "" } })?.text).toBe("")
  })
})

describe("approval cards: interactive button clicks resolve them", () => {
  test("a protected call hangs; the card's approve click resolves it", async () => {
    const model = scriptedModel([
      { text: "", toolCalls: [{ id: "t1", name: "enable", input: { name: "note_write" } }] },
      { text: "", toolCalls: [{ id: "t2", name: "note_write", input: { text: "ship v2" } }] },
      finalJson("saved")
    ])
    const gate = new ManualGate(() => true)
    const sent: PendingApproval[] = []
    const host = new MantisHost({
      model,
      approval: {
        gate,
        requires: (request) => request.tool === "note_write",
        notify: (pending) => {
          sent.push(pending)
          return Promise.resolve()
        }
      }
    })
    const running = host.run(new MockChannel())
    try {
      const turn = host.handle(msg({ id: "a1", text: "note it: ship v2", conversationId: "cid-a" }))
      await waitFor(async () => (await Effect.runPromise(gate.listPending())).length === 1)
      expect(sent).toHaveLength(1)
      expect(sent[0]!.input.tool).toBe("note_write")
      expect(JSON.stringify(sent[0]!.input.input)).toContain("ship v2")
      expect(mantisNotes(host, "cid-a", "ship v2")).toBe(0) // not committed yet
      // the owner clicks 同意 on the card - resolves the waiting call, no text
      await host.handleCardAction({ callId: sent[0]!.callId, action: "approve" })
      const out = await turn
      expect(out?.text).toBe("saved")
      expect(mantisNotes(host, "cid-a", "ship v2")).toBe(1)
    } finally {
      void running
    }
  })

  test("a deny click cancels the write and the agent answers the recovery", async () => {
    const model = scriptedModel([
      { text: "", toolCalls: [{ id: "t1", name: "enable", input: { name: "note_write" } }] },
      { text: "", toolCalls: [{ id: "t2", name: "note_write", input: { text: "delete everything" } }] },
      finalJson("understood, I did not write it")
    ])
    const gate = new ManualGate(() => true)
    const sent: PendingApproval[] = []
    const host = new MantisHost({
      model,
      approval: {
        gate,
        requires: (request) => request.tool === "note_write",
        notify: (pending) => {
          sent.push(pending)
          return Promise.resolve()
        }
      }
    })
    const running = host.run(new MockChannel())
    try {
      const turn = host.handle(msg({ id: "b1", text: "delete everything", conversationId: "cid-b" }))
      await waitFor(async () => (await Effect.runPromise(gate.listPending())).length === 1)
      await host.handleCardAction({ callId: sent[0]!.callId, action: "deny" })
      const out = await turn
      expect(mantisNotes(host, "cid-b", "delete everything")).toBe(0) // never written
      expect(out?.text).toBe("understood, I did not write it")
    } finally {
      void running
    }
  })
})

describe("mantis host: unified logging", () => {
  const capture = () => {
    const entries: Array<{ level: string; scope: string; message: string; meta?: unknown }> = []
    return {
      entries,
      logger: makeLogger({ level: "debug", write: (entry) => entries.push(entry) }, "host")
    }
  }

  test("session events flow into the host logger", async () => {
    const model = scriptedModel([
      { text: "", toolCalls: [{ id: "t1", name: "enable", input: { name: "note_write" } }] },
      finalJson("hello")
    ])
    const cap = capture()
    const host = new MantisHost({ model, logger: cap.logger })
    const reply = await host.deliver(msg({ id: "l1", text: "hi", conversationId: "cid-log" }))
    expect(reply?.text).toBe("hello")
    const messages = cap.entries.map((e) => e.message)
    expect(messages.some((m) => m === "session started")).toBe(true)
    expect(messages.some((m) => m === "session completed")).toBe(true)
    expect(messages.some((m) => m === "tool call")).toBe(true)
    expect(cap.entries.some((e) => e.scope.startsWith("host.session.cid-log"))).toBe(true)
  })

  test("a failing approval notify is logged, not fatal", async () => {
    const model = scriptedModel([
      { text: "", toolCalls: [{ id: "t1", name: "enable", input: { name: "note_write" } }] },
      { text: "", toolCalls: [{ id: "t2", name: "note_write", input: { text: "x" } }] },
      finalJson("done")
    ])
    const gate = new ManualGate(() => true)
    const cap = capture()
    const channel = new MockChannel()
    const host = new MantisHost({
      model,
      logger: cap.logger,
      approval: {
        gate,
        requires: (request) => request.tool === "note_write",
        notify: async () => { throw new Error("card send exploded") }
      }
    })
    const running = host.run(channel)
    try {
      const turn = channel.push(msg({ id: "l2", text: "note x", conversationId: "cid-err" }))
      await waitFor(async () => cap.entries.some((e) => e.message === "approval notify failed"))
      expect(cap.entries.some((e) => e.message === "approval notify failed")).toBe(true)
      // the host is still alive: resolve the pending manually and the turn ends
      const pending = await Effect.runPromise(gate.listPending())
      await Effect.runPromise(gate.resolve(pending[0]!.callId, true))
      await turn
    } finally {
      void running
    }
  })
})

describe("mantis host: interactive card buttons", () => {
  const modelFor = () => scriptedModel([
    { text: "", toolCalls: [{ id: "t1", name: "enable", input: { name: "note_write" } }] },
    { text: "", toolCalls: [{ id: "t2", name: "note_write", input: { text: "card approved write" } }] },
    finalJson("saved")
  ])

  test("an approve button click resolves the waiting protected call", async () => {
    const gate = new ManualGate(() => true)
    const channel = new MockChannel()
    const host = new MantisHost({
      model: modelFor(),
      approval: { gate, requires: (request) => request.tool === "note_write" }
    })
    const running = host.run(channel)
    try {
      const turn = channel.push(msg({ id: "c1", text: "note it", conversationId: "cid-card" }))
      await waitFor(async () => (await Effect.runPromise(gate.listPending())).length === 1)
      const pending = await Effect.runPromise(gate.listPending())
      // the card button click arrives on TOPIC_CARD with outTrackId = callId
      await host.handleCardAction({ callId: pending[0]!.callId, action: "approve" })
      const out = await turn
      expect(out?.text).toBe("saved")
      expect(mantisNotes(host, "cid-card", "card approved write")).toBe(1)
    } finally {
      void running
    }
  })

  test("a deny button click cancels the write; stale clicks are ignored", async () => {
    const gate = new ManualGate(() => true)
    const channel = new MockChannel()
    const host = new MantisHost({
      model: scriptedModel([
        { text: "", toolCalls: [{ id: "t1", name: "enable", input: { name: "note_write" } }] },
        { text: "", toolCalls: [{ id: "t2", name: "note_write", input: { text: "denied by card" } }] },
        finalJson("understood")
      ]),
      approval: { gate, requires: (request) => request.tool === "note_write" }
    })
    const running = host.run(channel)
    try {
      const turn = channel.push(msg({ id: "c2", text: "note denied", conversationId: "cid-card2" }))
      await waitFor(async () => (await Effect.runPromise(gate.listPending())).length === 1)
      const pending = await Effect.runPromise(gate.listPending())
      await host.handleCardAction({ callId: pending[0]!.callId, action: "deny" })
      const out = await turn
      expect(mantisNotes(host, "cid-card2", "denied by card")).toBe(0)
      expect(out?.text).toBe("understood")
      // a duplicate/stale click never throws
      await expect(host.handleCardAction({ callId: "no-such-call", action: "approve" })).resolves.toBeUndefined()
    } finally {
      void running
    }
  })
})