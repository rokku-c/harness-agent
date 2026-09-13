export const CONFIG_SAMPLES: Readonly<Record<string, string>> = {
  "claude-code": '{ "model": "claude-sonnet-4-5", "cwd": "/workspace", "permissionMode": "bypassPermissions", "allowedTools": ["Read", "Edit"] }',
  "claude-cc": '{ "model": "claude-sonnet-4-5", "cwd": "/workspace", "consent": { "autoApproveTools": ["Read"], "defaultDecision": "ask" } }',
  "effect-ops": '{ "model": "scripted", "cwd": "/workspace", "consent": { "autoApproveTools": [], "defaultDecision": "ask" } }',
  codex: '{ "codexModel": "o4-mini", "cwd": "/workspace", "codexApprovalMode": "full-auto", "sandbox": "read-only" }',
  gemini: '{ "geminiModel": "gemini-2.5-pro", "cwd": "/workspace", "geminiProject": "my-project" }',
  pi: '{ "piModel": "pi-large", "cwd": "/workspace" }',
  effect: '{ "model": "deepseek", "systemPrompt": "You are a rigorous engineer.", "maxSteps": 12 }',
  custom: '{ "label": "my-agent", "command": "myagent", "args": ["-m", "fast"], "cwd": "/workspace" }',
  demo: '{ "label": "demo", "consent": { "autoApproveTools": ["note_write"], "defaultDecision": "deny" } }'
}
