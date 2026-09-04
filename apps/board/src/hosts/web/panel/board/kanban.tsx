/** panel/board/kanban.tsx - the BOARD view: columns + item cards.
 *  Concept: cards render what the backend view declares (col.id + ordered
 *  itemIds); clicking a card opens its detail modal. */
import { useRef, type JSX } from "react"
import { Avatar, Badge, Group, Text, Tooltip } from "@mantine/core"
import { prioColor, prioLevel, stateColor, When } from "./helpers.tsx"
import type { ColInfo, WorkItem } from "../api.ts"

export function ItemCard({ item, onOpen }: { item: WorkItem; onOpen: (id: string) => void }): JSX.Element {
  const p = prioLevel(item.priority)
  return (
    <button type="button" className="item-card" onClick={() => onOpen(item.itemId)}>
      <Text fw={600} size="sm" lh={1.35} style={{ overflowWrap: "anywhere" }}>{item.title}</Text>
      <Group gap={6} mt={6} wrap="wrap">
        <Badge size="xs" variant="light" color={stateColor(item.state)}>{item.state}</Badge>
        <When c={p !== ""}>
          <Badge size="xs" variant="light" color={prioColor(p!)}>{p}</Badge>
        </When>
      </Group>
      <Group gap={8} mt={8} justify="space-between">
        <Group gap={6}>
          <When c={(item.requires?.length ?? 0) > 0}>
            <Text size="xs" c="dimmed">{(item.requires ?? []).length} claim{(item.requires ?? []).length > 1 ? "s" : ""}</Text>
          </When>
          <When c={(item.children?.length ?? 0) > 0}>
            <Text size="xs" c="dimmed">{(item.children ?? []).length} sub</Text>
          </When>
        </Group>
        <When c={!!item.assigneeId}>
          <Tooltip label={"assigned to " + item.assigneeId}>
            <Avatar size={17} radius="xl" color="brand" variant="light">{String(item.assigneeId ?? "?").slice(0, 1).toUpperCase()}</Avatar>
          </Tooltip>
        </When>
      </Group>
    </button>
  )
}

export function Kanban({ cols, items, onOpen }: { cols: ColInfo[]; items: WorkItem[]; onOpen: (id: string) => void }): JSX.Element {
  const byId = useRef(new Map<string, WorkItem>())
  byId.current = new Map(items.map((i) => [i.itemId, i]))
  return (
    <div className="kanban">
      {cols.map((col) => {
        const itemsIn = col.itemIds.map((id) => byId.current.get(id)).filter(Boolean) as WorkItem[]
        return (
          <section className="col" key={col.id}>
            <header className="col-head">
              <Text size="sm" fw={650}>{col.title}</Text>
              <span className="col-count">{itemsIn.length}</span>
            </header>
            <div className="col-body">
              {itemsIn.map((it) => <ItemCard key={it.itemId} item={it} onOpen={onOpen} />)}
              <When c={itemsIn.length === 0}><Text size="xs" c="dimmed" ta="center" py="sm">empty</Text></When>
            </div>
          </section>
        )
      })}
    </div>
  )
}
