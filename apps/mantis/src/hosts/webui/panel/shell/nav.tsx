/** shell/nav.tsx - tab NAVIGATION for both pointer modes.
 *  Concept: desktop gets a Tabs.List row; the compact (mobile) viewport
 *  gets a bottom nav with touch targets (56px, touchAction: manipulation)
 *  and safe-area padding - the same three destinations, both input styles. */
import { type JSX } from "react"
import { Badge, Tabs } from "@mantine/core"
import { IconCheck, IconHistory, IconSend } from "@tabler/icons-react"

export type TabKey = "chat" | "workspace" | "approvals"

const NAV_ITEMS: Array<{ key: TabKey; label: string; icon: JSX.Element }> = [
  { key: "chat", label: "会话", icon: <IconSend size={19} /> },
  { key: "workspace", label: "工作区", icon: <IconHistory size={19} /> },
  { key: "approvals", label: "审批", icon: <IconCheck size={19} /> }
]

/** desktop: the row of tab buttons under the header */
export const TabBar = ({
  value, onChange, pendingCount
}: { value: TabKey; onChange: (tab: TabKey) => void; pendingCount: number }): JSX.Element => (
  <Tabs.List px="sm" pt={4} style={{ borderBottom: "1px solid var(--mantine-color-dark-4)", flex: "none" }}>
    <Tabs.Tab value="chat">会话</Tabs.Tab>
    <Tabs.Tab value="workspace">工作区</Tabs.Tab>
    <Tabs.Tab value="approvals" rightSection={pendingCount > 0 ? <Badge size="xs" circle color="yellow">{pendingCount}</Badge> : undefined}>
      审批
    </Tabs.Tab>
  </Tabs.List>
)

/** compact: the bottom touch navigation with pending badge */
export const BottomNav = ({
  value, onChange, pendingCount
}: { value: TabKey; onChange: (tab: TabKey) => void; pendingCount: number }): JSX.Element => (
  <nav
    aria-label="console tabs"
    style={{
      flex: "none", display: "flex", borderTop: "1px solid var(--mantine-color-dark-4)",
      background: "var(--mantine-color-body)", paddingBottom: "env(safe-area-inset-bottom, 0px)",
      position: "sticky", bottom: 0, zIndex: 5
    }}
  >
    {NAV_ITEMS.map((item) => {
      const active = value === item.key
      const badge = item.key === "approvals" && pendingCount > 0 ? pendingCount : undefined
      return (
        <button
          key={item.key}
          aria-label={item.label}
          aria-current={active ? "page" : undefined}
          onClick={() => onChange(item.key)}
          style={{
            flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 3, height: 56, padding: 0, border: "none", cursor: "pointer", touchAction: "manipulation",
            background: "transparent", color: active ? "var(--mantine-color-brand-4)" : "var(--mantine-color-dimmed)"
          }}
        >
          <span style={{ position: "relative", display: "inline-flex" }}>
            {item.icon}
            {badge !== undefined && badge !== 0 && (
              <span style={{ position: "absolute", top: -5, right: -9, fontSize: 8.5, lineHeight: "13px", minWidth: 13, padding: "0 3px", textAlign: "center", borderRadius: 7, color: "#fff", background: active ? "var(--mantine-color-brand-5)" : "var(--mantine-color-yellow-6)" }}>{badge}</span>
            )}
          </span>
          <span style={{ fontSize: 9.5, lineHeight: 1 }}>{item.label}</span>
        </button>
      )
    })}
  </nav>
)
