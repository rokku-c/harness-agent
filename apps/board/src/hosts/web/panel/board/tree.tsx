import { Group, Paper, Stack, Text } from "@mantine/core"
import type { WorkItem } from "../../../../domain.ts"

const stateColor: Record<string, string> = { done: "green", doing: "blue", blocked: "orange", failed: "red", cancelled: "gray" }

export function TreeView({ items, onOpen }: { items: ReadonlyArray<WorkItem>; onOpen: (id: string) => void }) {
  const byId = new Map(items.map((item) => [item.itemId, item]))
  const roots = items.filter((item) => item.parentId === undefined)
  const render = (item: WorkItem, depth: number): JSX.Element => (
    <Stack key={item.itemId} gap={4} ml={depth * 18}>
      <Paper withBorder p="xs" onClick={() => onOpen(item.itemId)} style={{ cursor: "pointer" }}>
        <Group justify="space-between"><Text size="sm" fw={item.kind !== "leaf" ? 600 : 400}>{item.title}</Text><Text size="xs" c={stateColor[item.state] ?? "dimmed"}>{item.state}</Text></Group>
      </Paper>
      {item.children.map((id) => { const child = byId.get(id); return child ? render(child, depth + 1) : null })}
    </Stack>
  )
  return <Stack gap="xs">{roots.map((item) => render(item, 0))}</Stack>
}
