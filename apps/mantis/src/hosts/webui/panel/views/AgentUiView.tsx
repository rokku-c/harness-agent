/** Agent-rendered UI: official A2UI renderer + version history management */
import { type JSX } from "react"
import { Button, Group, Select, Text } from "@mantine/core"
import { IconHistory, IconSparkles } from "@tabler/icons-react"
import { panel, usePanel } from "../store.ts"
import { A2uiHost } from "../a2ui/A2uiHost.tsx"
import { fmtTime } from "../common.ts"

export const AgentUiView = (): JSX.Element => {
  const state = usePanel()
  const current = state.uiVersion
  const versions = state.uiVersions
  const selectValue = current !== undefined ? String(current) : versions.length > 0 ? String(versions[versions.length - 1]!.n) : undefined

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ padding: "6px 12px", borderBottom: "1px solid var(--mantine-color-dark-4)", display: "flex", alignItems: "center", gap: 10 }}>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ marginRight: "auto" }}>Agent surface</Text>
        {current !== undefined && (
          <Text size="xs" c="dimmed">#{current}{state.uiAuthor !== undefined ? " · " + state.uiAuthor : ""}</Text>
        )}
        {versions.length > 0 && (
          <Group gap={6}>
            <Select
              size="xs"
              data={versions.map((v) => ({ value: String(v.n), label: "#" + v.n + " " + fmtTime(Number(v.ts)) + (v.n === current ? " · current" : "") }))}
              value={selectValue}
              onChange={(value) => { if (value !== null) void panel.uiRestore(Number(value)) }}
              style={{ width: 200 }}
              allowDeselect={false}
            />
          </Group>
        )}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "10px 16px" }} className="a2ui-dark">
        {state.uiEmpty && (
          <div style={{ textAlign: "center", marginTop: 60 }}>
            <IconSparkles size={26} style={{ color: "var(--mantine-color-dimmed)", marginBottom: 8 }} />
            <Text size="sm" c="dimmed">
              No agent surface yet. Ask mantis in Chat to render one (it uses the official A2UI v0.9 protocol).
            </Text>
          </div>
        )}
        {!state.uiEmpty && state.uiMessages !== null && current !== undefined && (
          <A2uiHost version={current} messages={state.uiMessages} onAction={(action) => {
            const values: Record<string, string> = {}
            const context = action.context
            if (context !== null && typeof context === "object" && !Array.isArray(context)) {
              for (const [key, value] of Object.entries(context as Record<string, unknown>)) {
                if (value !== undefined && value !== null) values[key] = String(value)
              }
            }
            void panel.uiAction(action.name, values)
          }} />
        )}
      </div>
    </div>
  )
}
