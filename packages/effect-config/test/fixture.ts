import { afterEach } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeConfigRegistry, makeSqliteConfigStore, z, type ConfigDeclaration } from "../src/index.ts"

const disposers: (() => void)[] = []
afterEach(() => { for (const dispose of disposers.splice(0).reverse()) dispose() })

export function workspace() {
  const dir = mkdtempSync(join(tmpdir(), "effect-config-"))
  disposers.push(() => rmSync(dir, { recursive: true, force: true }))
  return { file: join(dir, "nested", "config.sqlite") }
}

export const declaration: ConfigDeclaration = {
  appId: "demo",
  schema: z.object({
    label: z.string().default("schema"),
    limit: z.number().int().positive().default(3),
    enabled: z.boolean().default(false),
    providers: z.array(z.object({ id: z.string(), url: z.string() })).default([]),
  }),
  default: { label: "declaration" },
}

export function open(file: string, decl = declaration) {
  const store = makeSqliteConfigStore({ file })
  disposers.push(() => store.close())
  const registry = makeConfigRegistry({ store })
  registry.register(decl)
  return { store, registry }
}
