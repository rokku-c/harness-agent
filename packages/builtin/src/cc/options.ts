/**
 * cc/options.ts - what configuring ClaudeCode means (driver options).
 *
 * Concept: the knobs one driver instance may carry. The raw SDK Options are
 * passed through minus outputFormat/hooks (the driver derives those from the
 * request and the native hooks slot respectively); tests inject a query stub
 * and an isolated CLAUDE_CONFIG_DIR.
 */
import type { Options } from "@anthropic-ai/claude-agent-sdk"
import { query } from "@anthropic-ai/claude-agent-sdk"

export interface ClaudeCodeOptions extends Omit<Options, "outputFormat" | "hooks"> {
  /** Injectable query - tests pass a stub here instead of the SDK. */
  readonly query?: typeof query
  /** Native Claude Code hooks, passed straight through (not HarnessHooks). */
  readonly claudeCodeHooks?: Options["hooks"]
  /** Isolated CLAUDE_CONFIG_DIR; a random temporary directory is used when omitted. */
  readonly claudeHome?: string
}
