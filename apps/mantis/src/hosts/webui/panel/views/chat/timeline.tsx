/** views/chat/timeline.tsx - the SCROLLING timeline of one conversation.
 *  Concept: a header names the conversation + item count; the body auto-
 *  scrolls to the newest entry whenever the timeline grows or the
 *  conversation switches; rows come from ./rows.tsx. */
import { type JSX, useEffect, useRef } from "react"
import { Text } from "@mantine/core"
import type { TimelineItem } from "../../store.ts"
import { shortId } from "../../common.ts"
import { MessageRow } from "./rows.tsx"

export const TimelinePane = ({
  effective, items
}: { effective: string; items: ReadonlyArray<TimelineItem> }): JSX.Element => {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [items.length, effective])
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
      <div style={{ padding: "5px 12px", borderBottom: "1px solid var(--mantine-color-gray-2)", display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
        <Text size="xs" fw={700} style={{ fontFamily: "var(--mantine-font-family-monospace)" }}>{shortId(effective)}</Text>
        <Text size="xs" c="dimmed">{items.length} 条</Text>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: "8px 12px", minHeight: 0 }}>
        {items.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" style={{ marginTop: 48 }}>还没有消息——在下方给它派个活吧。</Text>
        )}
        {items.map((item, i) => <MessageRow key={i} item={item} />)}
      </div>
    </div>
  )
}
