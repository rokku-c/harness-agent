/** Current Mantis configuration contract. */
import { describe, expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadConfig } from "../src/config.ts"

describe("config", () => {
  const writeFixture = (content: string): string => {
    const dir = mkdtempSync(join(tmpdir(), "mantis-cfg-"))
    const file = join(dir, "config.toml")
    writeFileSync(file, content)
    return file
  }

  test("dws channel + openai provider when no robot credentials", () => {
    const file = writeFixture(`
[agent]
provider_type = "openai"
model = "gpt-4o-mini"
api_key = "sk-local"
base_url = "https://api.example.com/v1"
`)
    process.env.MANTIS_CHANNEL = "dws"
    process.env.MANTIS_CONFIG_FILE = file
    const config = loadConfig()
    delete process.env.MANTIS_CONFIG_FILE
    expect(config.channel).toBe("dws")
    expect(config.robot).toBeUndefined()
    expect(config.model.api).toBe("openai.chat")
    expect(config.model.baseURL).toBe("https://api.example.com/v1")
    delete process.env.MANTIS_CHANNEL
  })

})
