/** Console shell (canvas v1): 会话 / 工作区 / 审批 + 右上角最小状态。
 *  One job per screen: watch a work line (chat), review what it wrote
 *  (workspace), or let a protected write through (approvals).
 *  Split by concept into ./shell/: header.tsx (top bar status) and nav.tsx
 *  (desktop Tabs.List + compact bottom touch nav); this file only tabs. */
import { type JSX, useEffect, useState } from "react"
import { Tabs } from "@mantine/core"
import { panel, usePanel } from "./store.ts"
import { useCompactViewport } from "./common.ts"
import { ChatView } from "./views/ChatView.tsx"
import { ApprovalsView } from "./views/ApprovalsView.tsx"
import { WorkspaceView } from "./views/WorkspaceView.tsx"
import { ConsoleHeader } from "./shell/header.tsx"
import { TabBar, BottomNav, type TabKey } from "./shell/nav.tsx"

export const App = (): JSX.Element => {
  const state = usePanel()
  const [tab, setTab] = useState<TabKey>("chat")
  const compact = useCompactViewport()

  useEffect(() => panel.start(), [])

  const pendingCount = state.pending.length

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <ConsoleHeader state={state} compact={compact} />
      <Tabs value={tab} onChange={(v) => setTab((v ?? "chat") as TabKey)} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {!compact && <TabBar value={tab} onChange={setTab} pendingCount={pendingCount} />}
        <div style={{ flex: 1, minHeight: 0 }}>
          <Tabs.Panel value="chat" style={{ height: "100%" }}><ChatView /></Tabs.Panel>
          <Tabs.Panel value="workspace" style={{ height: "100%" }}><WorkspaceView /></Tabs.Panel>
          <Tabs.Panel value="approvals" style={{ height: "100%" }}><ApprovalsView /></Tabs.Panel>
        </div>
        {compact && <BottomNav value={tab} onChange={setTab} pendingCount={pendingCount} />}
      </Tabs>
    </div>
  )
}
