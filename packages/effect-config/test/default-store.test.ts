import { expect, test } from "bun:test"
import { dirname } from "node:path"
import { workspace } from "./fixture.ts"

test("default registry creates SQLite lazily in its working directory and closes its own store", () => {
  const directory = dirname(dirname(workspace().file))
  const module = JSON.stringify(import.meta.resolve("../src/index.ts"))
  const child = Bun.spawnSync([process.execPath, "--eval", `
    import { makeConfigRegistry, z } from ${module};
    import { existsSync } from "node:fs";
    const file = ".effect-agent/config.sqlite";
    const decl = { appId: "demo", schema: z.object({ count: z.number().default(1) }) };
    const first = makeConfigRegistry();
    first.register(decl);
    first.apply("demo");
    const beforeInitialize = existsSync(file);
    const initialized = first.initialize("demo");
    const afterInitialize = existsSync(file);
    first.close();
    first.close();
    const closedRead = first.read("demo").ok;
    const second = makeConfigRegistry();
    second.register(decl);
    const reopened = second.read("demo");
    second.close();
    console.log(JSON.stringify({ beforeInitialize, afterInitialize, closedRead, initialized, reopened }));
  `], { cwd: directory })
  expect(child.exitCode).toBe(0)
  const result = JSON.parse(child.stdout.toString())
  expect(result.beforeInitialize).toBe(false)
  expect(result.afterInitialize).toBe(true)
  expect(result.closedRead).toBe(false)
  expect(result.initialized).toEqual({ ok: true, appId: "demo", value: { count: 1 },
    sources: { count: "default" }, revision: 1 })
  expect(result.reopened).toEqual(result.initialized)
})
