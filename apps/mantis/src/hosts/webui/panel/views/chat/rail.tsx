/** views/chat/rail.tsx - the conversation LIST rail.
 *  Concept: wide viewport = a 236px left column; narrow/touch = a horizontal
 *  strip (52px tall) above the timeline. Every row is a full-width button:
 *  id excerpt + turn count once its timeline has loaded. */
import { type JSX } from "react"
import { ActionIcon, Text, Tooltip } from "@mantine/core"
import { IconPlus } from "@tabler/icons-react"
import type { ConvInfo } from "../../api.ts"
import { panel } from "../../store.ts"
import { shortId, useCompactViewport } from "../../common.ts"

export const ConversationRail = ({
  conversations, effective, loaded
}: { conversations: ConvInfo[]; effective: string; loaded: (id: string) => boolean }): JSX.Element => {
  const compact = useCompactViewport()
  return (
    <div style={{
      flex: compact ? "0 0 52px" : "none",
      width: compact ? "100%" : 236,
      borderRight: compact ? "none" : "1px solid var(--mantine-color-dark-4)",
      borderBottom: compact ? "1px solid var(--mantine-color-dark-4)" : "none",
      display: "flex", flexDirection: compact ? "row" : "column", alignItems: "center",
      background: "var(--mantine-color-dark-6)"
    }}>
      <div style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
        <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ display: compact ? "none" : undefined }}>工作线</Text>
        <Tooltip label="新建工作线">
          <ActionIcon size={compact ? "md" : "sm"} variant="subtle" onClick={() => panel.newConversation()} aria-label="新建工作线">
            <IconPlus size={15} />
          </ActionIcon>
        </Tooltip>
      </div>
      <div style={compact
        ? { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, overflowX: "auto", overflowY: "hidden", padding: "0 8px", height: "100%" }
        : { overflow: "auto", flex: 1, width: "100%" }}>
        {conversations.length === 0 && <Text size="xs" c="dimmed" p="sm">还没有工作线：点右上 + 新建一条。</Text>}
        {conversations.map((c) => {
          const selected = c.conversationId === effective
          return (
            <button
              key={c.conversationId}
              onClick={() => panel.selectConversation(c.conversationId)}
              style={{
                flex: "none",
                display: compact ? "inline-flex" : "block",
                minWidth: compact ? 118 : undefined,
                width: compact ? undefined : "100%",
                textAlign: compact ? "center" : "left",
                padding: "4px 10px",
                margin: compact ? 0 : undefined,
                cursor: "pointer", border: "none", borderRadius: compact ? 10 : 0,
                background: selected ? "var(--mantine-color-brand-5)" : "transparent",
                color: selected ? "#fff" : "var(--mantine-color-text)",
                height: compact ? 34 : undefined, alignSelf: "center"
              }}
            >
              <div style={{ fontSize: 11, fontFamily: "var(--mantine-font-family-monospace)", fontWeight: 600, display: "flex", justifyContent: "space-between", gap: 6, alignItems: "baseline" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: compact ? 88 : undefined }}>{shortId(c.conversationId)}</span>
                {loaded(c.conversationId) && <span style={{ fontSize: 9, opacity: 0.65, flex: "none" }}>{c.turns}</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
