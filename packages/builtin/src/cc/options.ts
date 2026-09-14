import type { Options } from "@anthropic-ai/claude-agent-sdk"
import { query } from "@anthropic-ai/claude-agent-sdk"

export interface ClaudeCodeOptions extends Omit<Options, "outputFormat" | "hooks"> {
  readonly query?: typeof query
  readonly claudeCodeHooks?: Options["hooks"]
  readonly claudeHome?: string
}
