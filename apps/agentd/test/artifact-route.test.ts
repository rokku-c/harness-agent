/**
 * P6 over HTTP: the surface a node fetches its bytes from.
 *
 * What is asserted here is the contract a probe depends on — the credential, the
 * envelope, and a message that names what is missing — rather than the JSON
 * shape, which the probe's own transport test would catch anyway.
 */

import { expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { startStandaloneApp } from "@effect-agent/effect-standalone"
import { effectApp } from "../src/effect-app.ts"
import { TOKEN } from "./probe-plane.ts"

interface Answer { readonly status: number; readonly body: Record<string, unknown> }
interface Wire { readonly files: ReadonlyArray<{ readonly path: string; readonly content: string }>; readonly digest: string }

/** A compiled artifact, as `compileEffectBundle` leaves it on disk. */
const sourceOf = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(tmpdir(), "agentd-source-"))
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), content)
  }
  return dir
}
const config = (bundleSource: string) => ({
  nodeToken: TOKEN,
  bundles: [
    { bundleId: "board", version: "1.0.0", abi: "effect-1", source: bundleSource },
    // Published as metadata only: a version every node is expected to have.
    { bundleId: "host", version: "1.0.0", abi: "effect-1", kind: "kernel", bootstrapAbi: "effect-1" },
  ],
})
const get = async (url: string, id: string | undefined, token?: string): Promise<Answer> => {
  const query = id === undefined ? "" : `?id=${encodeURIComponent(id)}`
  const response = await fetch(new URL(`/agentd/artifact${query}`, url), {
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  })
  return { status: response.status, body: await response.json() as Record<string, unknown> }
}
const serving = async <T>(files: Record<string, string>, run: (url: string) => Promise<T>): Promise<T> => {
  const source = sourceOf(files)
  const hosted = await startStandaloneApp({ app: effectApp, appRoutes: true, port: 0, config: config(source) })
  try { return await run(hosted.url) } finally { await hosted.stop(); rmSync(source, { recursive: true, force: true }) }
}

test("a version published from a directory is served, file by file", async () => {
  await serving({ "entry.os.js": "app", "nested/extra.js": "extra" }, async (url) => {
    const answer = await get(url, "board@1.0.0", TOKEN)
    expect(answer.status).toBe(200)
    expect(answer.body.ok).toBe(true)
    const wire = answer.body.artifact as Wire
    expect(wire.files.map((file) => file.path)).toEqual(["entry.os.js", "nested/extra.js"])
    // Base64, so the bytes survive a JSON hop that would otherwise mangle them.
    expect(wire.files.map((file) => Buffer.from(file.content, "base64").toString())).toEqual(["app", "extra"])
    expect(wire.digest).toMatch(/^[0-9a-f]{64}$/)
  })
})

test("the fetch is a node verb: no credential, no bytes", async () => {
  await serving({ "entry.os.js": "app" }, async (url) => {
    const answer = await get(url, "board@1.0.0")
    expect(answer.status).toBe(401)
    expect(answer.body).toEqual({ ok: false, error: "unauthorized artifact fetch" })
  })
})

test("a version with no directory says so, and says which version", async () => {
  await serving({ "entry.os.js": "app" }, async (url) => {
    const answer = await get(url, "host@1.0.0", TOKEN)
    expect(answer.status).toBe(404)
    expect(answer.body.error).toBe("no artifact bytes for host@1.0.0; nothing was published from a directory")
  })
})

test("asking for nothing in particular is the caller's mistake", async () => {
  await serving({ "entry.os.js": "app" }, async (url) => {
    const answer = await get(url, undefined, TOKEN)
    expect(answer.status).toBe(400)
    expect(String(answer.body.error)).toContain("id")
  })
})
