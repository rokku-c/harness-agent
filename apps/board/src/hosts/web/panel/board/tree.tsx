import { ActionIcon, Group, Paper, Stack, Text } from "@mantine/core"
import { useState } from "react"
import type { WorkItem } from "../../../../domain.ts"

const stateColor: Record<string, string> = { done: "green", doing: "blue", blocked: "orange", failed: "red", cancelled: "gray" }

export function TreeView({ items, onOpen }: { items: ReadonlyArray<WorkItem>; onOpen: (id: string) => void }) {
  const byId = new Map(items.map((item) => [item.itemId, item]))
  const roots = items.filter((item) => item.parentId === undefined)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const progress = (item: WorkItem): number => {
    if (item.children.length === 0) return item.state === "done" ? 1 : 0
    const children = item.children.map((id) => byId.get(id)).filter((child): child is WorkItem => child !== undefined)
    return children.length ? children.reduce((sum, child) => sum + progress(child), 0) / children.length : 0
  }
  const render = (item: WorkItem, depth: number): JSX.Element => (
    <Stack key={item.itemId} gap={4} ml={depth * 18}>
      <Paper withBorder p="xs" onClick={() => onOpen(item.itemId)} style={{ cursor: "pointer" }}>
        <Group justify="space-between"><Group gap={6}><ActionIcon size="sm" variant="subtle" disabled={item.children.length === 0} onClick={(event) => { event.stopPropagation(); setCollapsed((old) => { const next = new Set(old); next.has(item.itemId) ? next.delete(item.itemId) : next.add(item.itemId); return next }) }}>{item.children.length === 0 ? "·" : collapsed.has(item.itemId) ? "+" : "−"}</ActionIcon><Text size="sm" fw={item.kind !== "leaf" ? 600 : 400}>{item.title}</Text></Group><Group gap={8}><Text size="xs" c="dimmed">{Math.round(progress(item) * 100)}%</Text><Text size="xs" c={stateColor[item.state] ?? "dimmed"}>{item.state}</Text></Group></Group>
      </Paper>
      {!collapsed.has(item.itemId) && item.children.map((id) => { const child = byId.get(id); return child ? render(child, depth + 1) : null })}
    </Stack>
  )
  return <Stack gap="xs">{roots.map((item) => render(item, 0))}</Stack>
}
