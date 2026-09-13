import { expect, test } from "bun:test"
import { existsSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const CLI = new URL("../../../scripts/host-app.ts", import.meta.url).pathname
const scratch = (): string => mkdtempSync(join(tmpdir(), "app-host-"))

interface Hosted { readonly stderr: string; readonly stop: () => Promise<number> }

/**
 * Run `app:host board` from a scratch directory and wait until it says which
 * face it opened, leaving the process running so the caller can look at what it
 * touched before stopping it. Board's data file is a *relative* path, so the
 * working directory is what decides which file is the real one — running this
 * from the repository is the very accident these tests exist to prevent.
 */
const hostBoard = async (cwd: string, args: readonly string[]): Promise<Hosted> => {
  const child = Bun.spawn([process.execPath, CLI, "board", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
  const reader = child.stderr.getReader()
  const decoder = new TextDecoder()
  let stderr = ""
  while (!stderr.includes("MCP at")) {
    const chunk = await reader.read()
    if (chunk.done) break
    stderr += decoder.decode(chunk.value)
  }
  return { stderr, stop: async () => { child.kill("SIGINT"); return await child.exited } }
}

const failed = async (args: readonly string[]): Promise<{ code: number; stderr: string }> => {
  const child = Bun.spawn([process.execPath, CLI, "board", ...args], { cwd: scratch(), stdout: "pipe", stderr: "pipe" })
  const [stderr, code] = await Promise.all([new Response(child.stderr).text(), child.exited])
  return { code, stderr }
}

test("--config keeps the host off the file the manifest names, and says which layer it used", async () => {
  const cwd = scratch(), moved = join(cwd, "moved.sqlite")
  const host = await hostBoard(cwd, ["--config", JSON.stringify({ dataFile: moved })])
  try {
    expect(host.stderr).toContain("from override")
    expect(existsSync(moved)).toBe(true)
    expect(existsSync(join(cwd, ".effect-agent/board.sqlite"))).toBe(false)
  } finally { expect(await host.stop()).toBe(0) }
})

test("without --config the manifest's own file is the one written — the layer is unchanged", async () => {
  const cwd = scratch()
  const host = await hostBoard(cwd, [])
  try {
    expect(host.stderr).toContain("from yaml")
    expect(existsSync(join(cwd, ".effect-agent/board.sqlite"))).toBe(true)
  } finally { expect(await host.stop()).toBe(0) }
})

test("a --config file that is not there is refused before anything is hosted", async () => {
  const { code, stderr } = await failed(["--config", "@absent.yaml"])
  expect(code).toBe(1)
  expect(stderr).toContain("no such file: absent.yaml")
})

test("a layer that is not an object is refused by the config registry's own rule", async () => {
  const { code, stderr } = await failed(["--config", "[1,2]"])
  expect(code).toBe(1)
  expect(stderr).toContain("config layers must be objects")
})
