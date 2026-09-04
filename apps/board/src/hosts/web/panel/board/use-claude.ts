/** panel/board/use-claude.ts - the CLAUDE integration hook.
 *  Concept: scope state (repo|global) + status + one busy flag; probe on
 *  mount and on scope switch; apply/revert/check map onto the same MCP
 *  integration tools agents use, with a human-readable outcome message. */
import { useEffect, useState } from "react"
import { api, type ClaudeIntegrationState } from "../api.ts"

export const useClaude = (): {
  st: ClaudeIntegrationState | null
  busy: boolean
  msg: string
  scope: "repo" | "global"
  action: (action: "apply" | "revert" | "check") => Promise<void>
  switchScope: (s: string) => void
} => {
  const [st, setSt] = useState<ClaudeIntegrationState | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const [scope, setScope] = useState<"repo" | "global">("repo")

  const refreshClaude = async (s: "repo" | "global", probe: boolean): Promise<void> => {
    const r = await api.integrationGet(probe, s)
    setSt(r.ok && r.state ? r.state : null)
  }
  useEffect(() => { void refreshClaude(scope, true) }, [])

  const action = async (action: "apply" | "revert" | "check"): Promise<void> => {
    setBusy(true)
    setMsg("")
    try {
      const r = await api.integrationAction(action, scope)
      if (r.ok && r.state) {
        setSt(r.state)
        const scoped = scope === "global" ? "user-level (~/.claude.json + ~/.claude/CLAUDE.md)" : "repo (.mcp.json + CLAUDE.md + gate)"
        setMsg(
          action === "apply" ? "applied at " + scoped
          : action === "revert" ? "reverted at " + scoped + " to pre-integration state"
          : r.state.connected ? "connected: board reachable, executor claude-code declared"
          : "NOT connected: board gate would refuse to launch claude"
        )
      } else setMsg("error: " + String(r.detail ?? "?"))
    } finally { setBusy(false) }
  }

  const switchScope = (s: string): void => {
    setScope(s as "repo" | "global")
    void refreshClaude(s as "repo" | "global", true)
  }
  return { st, busy, msg, scope, action, switchScope }
}
