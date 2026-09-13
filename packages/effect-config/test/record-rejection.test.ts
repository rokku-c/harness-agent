import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { open, workspace } from "./fixture.ts"

for (const [field, value] of [
  ["initialized", 0], ["initialized", 2], ["revision", 0], ["revision", 1.5], ["value", "[]"],
  ["sources", "{}"], ["sources", '{"label":"invalid","limit":"default","enabled":"default","providers":"default"}'],
] as const) test(`invalid stored ${field}=${value} is rejected without replacing user data`, () => {
  const { file } = workspace()
  const { registry } = open(file)
  registry.initialize("demo")
  const db = new Database(file)
  try {
    db.run(`UPDATE app_config SET ${field} = ?`, [value])
    const before = db.query("SELECT * FROM app_config").all()
    for (const result of [registry.initialize("demo", { yaml: { limit: 9 } }),
      registry.read("demo"), registry.save("demo", { limit: 8 })]) {
      expect(result.ok).toBe(false)
      expect(result.error).toContain("operator must rebuild")
      // ...and the caller can act on that: the reason survives the registry's
      // error boundary, so nothing downstream has to match on the message.
      expect(result.reason).toBe("rebuild-required")
      expect(db.query("SELECT * FROM app_config").all()).toEqual(before)
    }
  } finally { db.close() }
})
