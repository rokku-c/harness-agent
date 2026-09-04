/**
 * config/legacy.ts - the LEGACY KEY REGISTRY.
 *
 * Concept: which original clawyp sections/keys the new engine still maps
 * (everything else in those sections is deprecated-but-accepted), and which
 * whole original sections are deprecated. Registry stays in one place so
 * audit.ts only asks "known?".
 */
export const AGENT_LIVE_KEYS = new Set([
  "provider_type", "model", "api_key", "base_url", "max_steps", "context_mode"
])
export const DINGTALK_LIVE_KEYS = new Set(["client_id", "client_secret"])
export const DINGTALK_FUTURE_KEYS = new Set(["agent_id", "card_template_id"])
export const DINGTALK_IDENTITY_KEYS = new Set(["group_id", "user_id"])

// --- every other original section is deprecated-but-accepted
export const DEPRECATED_TOP_SECTIONS = [
  "web", "tools", "tool_auto_run", "tool_context", "tool_result_processing",
  "tool_confirmation", "tool_registry", "mcp_servers", "mcpServers"
]

export const AGENT_KNOWN_SECTION_KEYS = new Set([
  "workspace_dir", "skills_dir", "agent_skills_dir", "soul_path", "reflection",
  "progress", "final_reply_review", "workspace_hygiene", "autonomy", "self_recall",
  "thought_stream", "vision", "session_situation", "fast_reaction", "model_tier",
  "message_routing", "reactions", "reaction_agent", "cyp_forwarding", "note_limit"
])
