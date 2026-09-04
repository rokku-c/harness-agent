/** board · multi-agent workboard - React + Mantine panel.
 *  The panel is a thin MCP client: every mutation goes to the board MCP
 *  tools through the web shell's /api proxy (the same tools Claude Code
 *  uses). Split by concept into ./board/: use-board (data hook), kanban,
 *  side, item-modal, new-item, new-resource, claude-card + use-claude.
 */
import { useState, type JSX } from "react"
import { ActionIcon, Button, Divider, Group, SegmentedControl, Text, Tooltip } from "@mantine/core"
import { IconLayoutKanban, IconPlus, IconRefresh } from "@tabler/icons-react"
import { Worktable } from "./Worktable.tsx"
import { useBoard } from "./board/use-board.ts"
import { Kanban } from "./board/kanban.tsx"
import { Resources, Executors, Activity } from "./board/side.tsx"
import { ItemModal } from "./board/item-modal.tsx"
import { NewItemModal } from "./board/new-item.tsx"
import { NewResourceModal } from "./board/new-resource.tsx"
import { ClaudeCard } from "./board/claude-card.tsx"
import { useClaude } from "./board/use-claude.ts"
import { tsText, When } from "./board/helpers.tsx"

export function BoardApp(): JSX.Element {
  const { snap, cols, evs, lastSync, refresh } = useBoard()
  const claude = useClaude()
  const [sel, setSel] = useState<string | null>(null)
  const [newItem, setNewItem] = useState(false)
  const [newRes, setNewRes] = useState(false)
  const [view, setView] = useState<"table" | "board">("table")
  const item = sel ? snap.items.find((i) => i.itemId === sel) : undefined

  return (
    <div className="app">
      <header className="top">
        <Group gap={8}>
          <IconLayoutKanban size={17} stroke={1.7} />
          <Text fw={700} size="md">board</Text>
          <Text size="xs" c="dimmed">multi-agent workboard</Text>
        </Group>
        <Group gap={6}>
          <Text size="xs" c="dimmed" className="mono">
            {lastSync ? "synced " + tsText(lastSync) : "…"}
          </Text>
          <Tooltip label="refresh"><ActionIcon size="lg" variant="subtle" onClick={() => void refresh()}><IconRefresh size={15} /></ActionIcon></Tooltip>
          <SegmentedControl size="xs" value={view} data={[{ value: "table", label: "Table" }, { value: "board", label: "Board" }]} onChange={(v) => setView(v as "table" | "board")} />
          <Divider orientation="vertical" />
          <Button size="xs" variant="default" leftSection={<IconPlus size={13} />} onClick={() => setNewRes(true)}>New resource</Button>
          <Button size="xs" leftSection={<IconPlus size={13} />} onClick={() => setNewItem(true)}>New item</Button>
        </Group>
      </header>
      <div className="body">
        <main className="main">
          <When c={view === "board"}><Kanban cols={cols} items={snap.items} onOpen={setSel} /></When>
          <When c={view === "table"}><Worktable cols={cols} items={snap.items} resources={snap.resources} onOpen={setSel} onRefresh={refresh} /></When>
        </main>
        <aside className="aside">
          <Resources res={snap.resources} />
          <Divider />
          <Executors execs={snap.executors} />
          <Divider />
          <ClaudeCard st={claude.st} busy={claude.busy} msg={claude.msg} scope={claude.scope} onScope={claude.switchScope}
            onApply={() => void claude.action("apply")} onRevert={() => void claude.action("revert")} onCheck={() => void claude.action("check")} />
          <Divider />
          <Activity evs={evs} />
        </aside>
      </div>
      <ItemModal open={!!sel && !!item} onClose={() => setSel(null)}
        item={item} onRefresh={refresh} onOpenSub={(id) => setSel(id)} />
      <NewItemModal open={newItem} onClose={() => setNewItem(false)} onRefresh={refresh} />
      <NewResourceModal open={newRes} onClose={() => setNewRes(false)} onRefresh={refresh} />
    </div>
  )
}
