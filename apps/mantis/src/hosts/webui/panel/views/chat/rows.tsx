/** views/chat/rows.tsx - one TIMELINE ENTRY as a row.
 *  Concept: msg rows bubble left/right by role; tool steps render as a
 *  compact monospace run (state-colored dot + tool badge + truncated
 *  detail w/ hover tooltip); local notes render italic, never as chat. */
import { type JSX } from "react"
import { Badge, Paper, Text, Tooltip } from "@mantine/core"
import type { TimelineItem } from "../../store.ts"
import { fmtTime } from "../../common.ts"

export const ToolRun = ({ item }: { item: TimelineItem & { kind: "tool" } }): JSX.Element => {
  const color = item.state === "ok" ? "var(--mantine-color-teal-6)" : item.state === "fail" ? "var(--mantine-color-red-6)" : "var(--mantine-color-brand-6)"
  const dot = item.state === "ok" ? "✓" : item.state === "fail" ? "✕" : "·"
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "1px 0", fontFamily: "var(--mantine-font-family-monospace)", fontSize: 11, color: "var(--mantine-color-dimmed)", minWidth: 0 }}>
      <span style={{ color, flex: "none", fontSize: 10, width: 12 }}>{dot}</span>
      <Badge size="xs" variant="light" color={item.state === "fail" ? "red" : item.state === "ok" ? "teal" : "brand"} style={{ fontFamily: "inherit", flex: "none" }}>
        {item.tool}
      </Badge>
      {item.detail !== undefined && item.detail.length > 0 && (
        <Tooltip label={item.detail} openDelay={350}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "default", minWidth: 0 }}>{item.detail}</span>
        </Tooltip>
      )}
      <span style={{ flex: "none", fontSize: 10, opacity: 0.65 }}>{item.state}</span>
    </div>
  )
}

export const MessageRow = ({ item }: { item: TimelineItem }): JSX.Element => {
  if (item.kind === "tool") return <ToolRun item={item} />
  if (item.kind === "note") {
    return <div style={{ fontSize: 11, color: "var(--mantine-color-dimmed)", fontStyle: "italic", padding: "2px 0" }}>{item.text}</div>
  }
  const mine = item.role === "user"
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", padding: "3px 0" }}>
      <div style={{ fontSize: 10, color: "var(--mantine-color-dimmed)", opacity: 0.75, margin: "0 2px 2px" }}>
        {mine ? "你" : "mantis"} · {fmtTime(item.ts)}
      </div>
      <Paper
        p="xs" radius="md" withBorder={!mine}
        style={{
          maxWidth: "85%", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13, lineHeight: 1.5,
          background: mine ? "var(--mantine-color-gray-1)" : "var(--mantine-color-white)",
          borderColor: mine ? undefined : "var(--mantine-color-gray-2)"
        }}
      >
        {item.text}
      </Paper>
    </div>
  )
}
