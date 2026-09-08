import { expect, test } from "bun:test"
import { mkdtempSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { resolve, join } from "node:path"
import { makePluginHost } from "@effect-agent/effect-host"
import { makeEffectRegistry, invoke } from "@effect-agent/effect-interface"
import { makeEgressRouter } from "@effect-agent/effect-network"
import { compileEffectBundle, loadEffectBundle } from "@effect-agent/effect-bundle"
import { memoryConfigs } from "./config-helpers.ts"

test("compiled task Board preserves asset paths and owns exactly its instance tools", async () => {
  const out = mkdtempSync(join(tmpdir(), "task-board-bundle-"))
  // A bundle externalizes SDK packages: the embedding host supplies its installed ABI.
  symlinkSync(resolve(import.meta.dir, "../../../node_modules"), join(out, "node_modules"), "dir")
  const host = makePluginHost(), registry = makeEffectRegistry(), configs = memoryConfigs()
  try {
    const manifest = await compileEffectBundle({ appDir: resolve(import.meta.dir, "../../board"), outDir: out })
    const dispose = await loadEffectBundle(join(out, manifest.bundleId + ".effect-bundle"), {
      host, registry, configs, network: makeEgressRouter({ role: "main" }),
      initializeConfig: (id) => { const result = configs.initialize(id, { yaml: { dataFile: ":memory:" } }); if (!result.ok) throw new Error(result.error) },
      activeConfig: (id) => configs.read(id).value,
    })
    const create = registry.tools().find((t) => t.tool.name === "board_create")!
    const created = await invoke(create.tool, { title: "compiled task" })
    expect((created as { title: string }).title).toBe("compiled task")
    const state = await host.handle(new Request("http://host/board/api/state"))
    expect((await state.json()).tasks[0].title).toBe("compiled task")
    expect((await host.handle(new Request("http://host/board/"))).headers.get("content-type")).toBe("text/html; charset=utf-8")
    expect((await host.handle(new Request("http://host/board/app.js"))).headers.get("content-type")).toBe("text/javascript; charset=utf-8")
    await dispose()
    expect(registry.tools()).toEqual([])
    expect(host.routes()).toEqual([])
  } finally { await host.close(); rmSync(out, { recursive: true, force: true }) }
})
