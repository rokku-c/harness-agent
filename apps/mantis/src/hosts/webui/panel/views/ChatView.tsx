/** Conversation view: session list + per-conversation timeline + composer.
 *  Responsive: wide = left rail of conversations; narrow/touch = a
 *  horizontal conversation strip above a full-height timeline (bottom nav
 *  in App). Split by concept into ./chat/: rail, timeline, rows, composer.
 */
import { type JSX } from "react"
import { conversationItems, conversationList, usePanel } from "../store.ts"
import { useCompactViewport } from "../common.ts"
import { ConversationRail } from "./chat/rail.tsx"
import { TimelinePane } from "./chat/timeline.tsx"
import { Composer } from "./chat/composer.tsx"

export const ChatView = (): JSX.Element => {
  const state = usePanel()
  const compact = useCompactViewport()
  const effective = state.activeConversation || (conversationList(state)[0]?.conversationId ?? "ui")
  const items = conversationItems(state, effective)
  const conversations = conversationList(state)
  return (
    <div style={{ display: "flex", flexDirection: compact ? "column" : "row", height: "100%", minHeight: 0 }}>
      <ConversationRail
        conversations={conversations}
        effective={effective}
        loaded={(id) => state.timelines[id] !== undefined}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <TimelinePane effective={effective} items={items} />
        <Composer effective={effective} />
      </div>
    </div>
  )
}
