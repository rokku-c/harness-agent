import { describe, expect, test } from "bun:test"
import { Effect, Either, Schema } from "effect"
import type { LanguageModel } from "ai"
import { requireUntil, Until, type Capabilities } from "../src/core.js"
import { VercelAgent } from "../src/vercel.js"
import { ClaudeCode } from "../src/composed/claude-code.js"
import { CodexAgent } from "../src/composed/codex.js"
import { PiAgent } from "../src/composed/pi.js"

/**
 * P0(b) negotiation matrix (DRAFT 12): this test only exercises the negotiation
 * path - each driver is constructed via make() with no credentials and run() is
 * never invoked, so the matrix reflects declared capabilities only and cannot
 * trigger a real LLM call.
 *
 * Declaration/run consistency notes (checked against each driver's run body):
 * - thinking: vercel (reasoningText ?? ""), claude-code (thinking block) and
 *   pi (thinking part) all expose a Thinking branch; codex declares thinking:false
 *   and has no Thinking branch (reasoning-summary extraction is a P1 candidate,
 *   p0.md 5.6-1) - declarations match run behavior.
 * - toolCall: all four declare toolCalls: "observe"; requireUntil rejects, so the
 *   drivers' ToolCall branches are unreachable through negotiation (claude-code
 *   marks its branch P1-only). No driver declares intercept without a branch.
 * - schema: vercel/claude-code/codex structuredOutput native, pi tool; every
 *   driver's run has a Schema branch - declarations match.
 * - usage (B4): vercel (generateText aggregate usage) and codex (turn.usage)
 *   emit UsageReported; pi and claude-code expose no clean usage surface in
 *   their SDKs (documented in their drivers) - support ✓ ✓ ✗ ✗.
 */

const untils: ReadonlyArray<readonly [string, Until<any>]> = [
  ["text", Until.text],
  ["thinking", Until.thinking],
  ["toolCall", Until.toolCall],
  ["stop", Until.stop],
  ["schema", Until.schema(Schema.String)]
]

const outcome = (capabilities: Capabilities, until: Until<any>): "OK" | "REJECT" => {
  const result = Effect.runSync(requireUntil("matrix-driver", capabilities, until).pipe(Effect.either))
  return Either.isRight(result) ? "OK" : "REJECT"
}

const drivers: ReadonlyArray<readonly [string, Capabilities]> = [
  ["vercel", VercelAgent.make({ model: {} as unknown as LanguageModel }).capabilities],
  ["claude-code", ClaudeCode.make().capabilities],
  ["codex", CodexAgent.make().capabilities],
  ["pi", PiAgent.make().capabilities]
]

const expected: Readonly<Record<string, Readonly<Record<string, "OK" | "REJECT">>>> = {
  vercel: { text: "OK", thinking: "OK", toolCall: "REJECT", stop: "OK", schema: "OK" },
  "claude-code": { text: "OK", thinking: "OK", toolCall: "REJECT", stop: "OK", schema: "OK" },
  codex: { text: "OK", thinking: "REJECT", toolCall: "REJECT", stop: "OK", schema: "OK" },
  pi: { text: "OK", thinking: "OK", toolCall: "REJECT", stop: "OK", schema: "OK" }
}

describe("capability negotiation matrix (P0(b))", () => {
  for (const [driverName, capabilities] of drivers) {
    test(`${driverName} negotiates the declared Until matrix`, () => {
      const actual: Record<string, "OK" | "REJECT"> = {}
      for (const [untilName, until] of untils) actual[untilName] = outcome(capabilities, until)
      expect(actual).toEqual(expected[driverName])
    })
  }
})