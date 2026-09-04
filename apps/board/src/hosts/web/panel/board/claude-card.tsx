/** panel/board/claude-card.tsx - the CLAUDE CODE integration side card.
 *  Concept: repo vs user-level integration state (applied + connected probe
 *  + which files exist), with apply / revert / test actions. Presentational;
 *  the API calls live in ./use-claude.ts. */
import { type JSX } from "react"
import { Button, Group, SegmentedControl, Stack, Text } from "@mantine/core"
import { IconPlug } from "@tabler/icons-react"
import type { ClaudeIntegrationState } from "../api.ts"
import { Dot, When } from "./helpers.tsx"

export function ClaudeCard({ st, busy, msg, scope, onScope, onApply, onRevert, onCheck }: {
  st: ClaudeIntegrationState | null
  busy: boolean
  msg: string
  scope: "repo" | "global"
  onScope: (s: string) => void
  onApply: () => void
  onRevert: () => void
  onCheck: () => void
}): JSX.Element {
  const dot = st?.applied ? (st.connected ? "green" : "amber") : "gray"
  const files = st?.files
  const isGlobal = scope === "global"
  const fileTags = files
    ? isGlobal
      ? [
          ["~/.claude.json board", files.mcpJson], ["~/.claude/CLAUDE.md", files.claudeMd]
        ].filter(([, present]) => present).map(([label]) => String(label))
      : [
          [".mcp.json", files.mcpJson], ["CLAUDE.md", files.claudeMd], ["gate", files.wrapper], ["prompt", files.systemPrompt]
        ].filter(([, present]) => present).map(([label]) => String(label))
    : []
  const applyLabel = isGlobal ? "Apply global" : "Apply repo"
  return (
    <div className="side-card">
      <div className="side-title"><IconPlug size={13} stroke={1.8} /><Text size="xs" fw={650}>CLAUDE CODE</Text></div>
      <SegmentedControl size="xs" value={scope} onChange={onScope} data={[{ value: "repo", label: "repo" }, { value: "global", label: "global" }]} fullWidth />
      <Stack gap={4}>
        <div className="side-row">
          <Dot tone={dot} />
          <Text size="sm" style={{ flex: 1 }}>integration</Text>
          <Text size="xs" c="dimmed">{st?.applied ? "applied" : "off"}</Text>
        </div>
        <div className="side-row">
          <Dot tone={st?.connected ? "green" : "gray"} />
          <Text size="sm" style={{ flex: 1 }}>board link</Text>
          <Text size="xs" c="dimmed">{st ? (st.connected ? "connected" : "not probed") : "…"}</Text>
        </div>
        <When c={!!st && !st.claudeCliExists}><Text size="xs" c="red">claude CLI not found</Text></When>
        <When c={fileTags.length > 0}><Text size="xs" c="dimmed" className="mono">{fileTags.join(" · ")}</Text></When>
        <When c={isGlobal && !!st?.home}><Text size="xs" c="dimmed" className="mono">home: {st?.home}</Text></When>
        <Group gap={4}>
          <Button size="xs" loading={busy} disabled={!!st?.applied} onClick={onApply} leftSection={<IconPlug size={12} />}>{applyLabel}</Button>
          <Button size="xs" variant="default" loading={busy} disabled={!st?.applied} onClick={onRevert}>Revert</Button>
          <Button size="xs" variant="subtle" loading={busy} disabled={!st?.applied} onClick={onCheck}>Test</Button>
        </Group>
        <When c={!!msg}><Text size="xs" c={msg?.startsWith("NOT") || msg?.startsWith("error") ? "red" : "dimmed"} style={{ overflowWrap: "anywhere" }}>{msg}</Text></When>
      </Stack>
    </div>
  )
}
