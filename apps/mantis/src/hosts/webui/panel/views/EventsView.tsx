/** Live event stream (raw bus feed, newest at the bottom) */
import { type JSX, useEffect, useRef } from "react"
import { Text } from "@mantine/core"
import { usePanel } from "../store.ts"
import { fmtTime } from "../common.ts"

const typeColor = (type: string): string => {
  if (type.startsWith("tool.ok")) return "var(--mantine-color-teal-5)"
  if (type.startsWith("tool.fail")) return "var(--mantine-color-red-5)"
  if (type.startsWith("tool.")) return "var(--mantine-color-brand-5)"
  if (type.startsWith("approval.")) return "var(--mantine-color-yellow-5)"
  if (type.startsWith("log.error")) return "var(--mantine-color-red-5)"
  if (type.startsWith("log.warn")) return "var(--mantine-color-yellow-5)"
  return "var(--mantine-color-dimmed)"
}

export const EventsView = (): JSX.Element => {
  const state = usePanel()
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [state.rawEvents.length])
  return (
    <div ref={scrollRef} style={{ height: "100%", overflow: "auto", padding: "8px 14px" }}>
      {state.rawEvents.map((e, i) => (
        <div key={i} style={{ display: "flex", gap: 10, padding: "1px 0", fontFamily: "var(--mantine-font-family-monospace)", fontSize: 11 }}>
          <Text span style={{ color: "var(--mantine-color-dimmed)", flex: "none" }}>{fmtTime(e.ts)}</Text>
          <Text span style={{ color: typeColor(e.type), flex: "none", minWidth: 96 }}>{e.type}</Text>
          <Text span c="dimmed" truncate="end" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{e.text}</Text>
        </div>
      ))}
      {state.rawEvents.length === 0 && <Text size="sm" c="dimmed" ta="center" style={{ marginTop: 40 }}>No events yet.</Text>}
    </div>
  )
}
