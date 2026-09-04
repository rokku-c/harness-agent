/**
 * config.toml compatibility: the ORIGINAL mantis config loads without edits;
 * honored keys map, deprecated keys warn (never crash), $ENV expands.
 */
import { describe, expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadConfig } from "../src/config.ts"

const ORIGINAL_SHAPE = `
[dingtalk]
client_id = "$DINGTALK_CLIENT_ID"
client_secret = "$DINGTALK_CLIENT_SECRET"
agent_id = "$DINGTALK_AGENT_ID"
card_template_id = "$DINGTALK_CARD_TEMPLATE_ID"

[web]
enabled = true
port = 3490

[agent]
provider_type = "anthropic"
model = "deepseek-v4-flash"
api_key = "$BAIZHI_API_KEY"
base_url = "https://ai-api-gateway.app.baizhi.cloud/api/anthropic/v1"
max_steps = 1024
workspace_dir = "./data"
skills_dir = "./skills"

[agent.reflection]
enabled = true
mode = "observe_only"
max_passes = 3
trigger_on_tool_error = true

[agent.autonomy]
enabled = true
tick_ms = 120000

[tools.bash]
enabled = false
timeout_ms = 30000

[tool_registry]
auto_discover = true
default_policy = "allow"
`

describe("config: original clawyp config.toml compatibility", () => {
  const writeFixture = (content: string): string => {
    const dir = mkdtempSync(join(tmpdir(), "mantis-cfg-"))
    const file = join(dir, "config.toml")
    writeFileSync(file, content)
    return file
  }

  test("loads the original file shape and maps honored keys", () => {
    process.env.DINGTALK_CLIENT_ID = "app-key-1"
    process.env.DINGTALK_CLIENT_SECRET = "app-secret-1"
    process.env.BAIZHI_API_KEY = "sk-1"
    const file = writeFixture(ORIGINAL_SHAPE)
    process.env.MANTIS_CONFIG_FILE = file
    const config = loadConfig()
    delete process.env.MANTIS_CONFIG_FILE
    expect(config.channel).toBe("robot") // creds present -> robot
    expect(config.robot?.clientId).toBe("app-key-1") // $ENV expanded
    expect(config.robot?.clientSecret).toBe("app-secret-1")
    expect(config.model.api).toBe("anthropic.messages")
    expect(config.model.model).toBe("deepseek-v4-flash")
    expect(config.model.apiKey).toBe("sk-1")
    expect(config.model.maxSteps).toBe(1024)
    expect(config.model.maxReflections).toBe(3) // reflection.max_passes maps
    // deprecated original keys are reported, never fatal
    expect(config.warnings.some((w) => w.includes("[web]"))).toBe(true)
    expect(config.warnings.some((w) => w.includes("[agent.autonomy]"))).toBe(true)
    expect(config.warnings.some((w) => w.includes("agent.\"workspace_dir\""))).toBe(true)
    expect(config.warnings.some((w) => w.includes("[tools]"))).toBe(true)
    expect(config.warnings.some((w) => w.includes("[tool_registry]"))).toBe(true)
    delete process.env.DINGTALK_CLIENT_ID
    delete process.env.DINGTALK_CLIENT_SECRET
    delete process.env.BAIZHI_API_KEY
    expect(config.robot?.agentId).toBe("") // accepted-for-future key, not deprecated
    expect(config.warnings.some((w) => w.includes("agent_id"))).toBe(false)
  })

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

  test("reflection warnings mention ignored sub-keys, not max_passes", () => {
    process.env.BAIZHI_API_KEY = "sk-1"
    const file = writeFixture(ORIGINAL_SHAPE)
    process.env.MANTIS_CONFIG_FILE = file
    const config = loadConfig()
    delete process.env.MANTIS_CONFIG_FILE
    const reflectionWarn = config.warnings.filter((w) => w.includes("agent.reflection"))
    expect(reflectionWarn.some((w) => w.includes("max_passes"))).toBe(false)
    expect(reflectionWarn.some((w) => w.includes("trigger_on_tool_error"))).toBe(true)
    expect(reflectionWarn.some((w) => w.includes("mode"))).toBe(true)
    delete process.env.BAIZHI_API_KEY
  })
})