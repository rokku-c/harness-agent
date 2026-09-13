/**
 * What the probe CLI refuses to start with, before it touches the network.
 *
 * The URL here is deliberately unreachable: every case below is a *startup*
 * gate, so a run that got as far as dialling would be a bug in the gate rather
 * than a slow test. §8.3 turned the declaration into an allowlist, which makes
 * these gates load-bearing — a probe that starts with an empty one announces a
 * node that carries nothing and then reports a refusal per beat.
 */

import { expect, test } from "bun:test"

const CLI = new URL("../../../scripts/agentd-probe.ts", import.meta.url).pathname
const UNREACHABLE = "http://127.0.0.1:1"

const run = async (args: readonly string[]): Promise<{ code: number; stderr: string }> => {
  const child = Bun.spawn([process.execPath, CLI, ...args], { stdout: "pipe", stderr: "pipe" })
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
  return { code, stderr }
}

test("a probe that cannot say what it is is refused at startup, not per beat", async () => {
  const noCapabilities = await run(["--url", UNREACHABLE, "--id", "m1", "--namespaces", "ops"])
  expect(noCapabilities.code).toBe(2)
  expect(noCapabilities.stderr).toContain("--capabilities is required")

  const noNamespaces = await run(["--url", UNREACHABLE, "--id", "m1", "--capabilities", "runtime:os"])
  expect(noNamespaces.code).toBe(2)
  expect(noNamespaces.stderr).toContain("--namespaces is required")
})

test("an empty list is the same refusal as a missing one", async () => {
  // The sharper of the two: `[]` is a *legal* declaration (§8.3 — carries
  // nothing), so a stray comma would be indistinguishable at plan time from a
  // node deliberately drained. It is not a declaration an operator types by
  // accident and means to keep.
  const empty = await run(["--url", UNREACHABLE, "--id", "m1", "--capabilities", "runtime:os", "--namespaces", ","])
  expect(empty.code).toBe(2)
  expect(empty.stderr).toContain("--namespaces is required")
})

test("a ceiling that is not a ceiling never reaches the control plane", async () => {
  const negative = await run([
    "--url", UNREACHABLE, "--id", "m1", "--capabilities", "runtime:os", "--namespaces", "ops", "--max-apps", "-1",
  ])
  expect(negative.code).toBe(2)
  expect(negative.stderr).toContain("--max-apps must be a non-negative integer")
})
