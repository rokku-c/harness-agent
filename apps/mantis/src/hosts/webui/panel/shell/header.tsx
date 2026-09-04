/** shell/header.tsx - the console top bar (品牌 + 状态徽章)。
 *  Concept: one glance answers "is the backend fresh? are approvals on?
 *  anything pending?" - compact viewport drops the prose badges. */
import { type JSX } from "react"
import { Badge, Group, Text, Tooltip } from "@mantine/core"
import type { PanelState } from "../store.ts"

export const ConsoleHeader = ({ state, compact }: { state: PanelState; compact: boolean }): JSX.Element => {
  const pendingCount = state.pending.length
  return (
    <header style={{ height: 44, flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "0 14px", borderBottom: "1px solid var(--mantine-color-dark-4)" }}>
      <Group gap={8}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--mantine-color-brand-5)", display: "inline-block" }} />
        <Text fw={700} size="md" style={{ letterSpacing: 0.2 }}>
          mantis <Text span c="dimmed" fw={500}>console</Text>
        </Text>
      </Group>
      <div style={{ flex: 1 }} />
      {!compact && !state.approvalsOn && state.pending.length === 0 && (
        <Tooltip label="本实例未配置审批门：agent 的写操作直接执行">
          <Badge size="xs" variant="outline" c="dimmed">审批未启用</Badge>
        </Tooltip>
      )}
      {state.approvalsOn && (
        <Badge size="xs" color={pendingCount > 0 ? "yellow" : "teal"} variant="light">
          {pendingCount > 0 ? pendingCount + " 条待批" : "审批已开启"}
        </Badge>
      )}
      {!compact && (
        <Badge size="xs" variant="dot" color={state.pollOk ? "teal" : "gray"} c={state.pollOk ? undefined : "dimmed"}>
          {state.pollOk ? "已轮询" : "轮询中"}
        </Badge>
      )}
    </header>
  )
}
