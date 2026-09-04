/** panel/board/item-modal.tsx - the WORK ITEM detail modal (read the whole
 *  item, act via the same MCP tools agents use - one api.act per button). */
import { type JSX, useState } from "react"
import { Badge, Button, Divider, Group, Modal, Stack, Text } from "@mantine/core"
import { api, type ActionResult, type WorkItem } from "../api.ts"
import { prioLevel, stateColor, When } from "./helpers.tsx"
export const ACTIONS: Array<{ key: string; label: string; variant: "filled" | "default" | "outline" | "subtle"; color?: string; when: string[] }> = [
  { key: "start", label: "Start", variant: "filled", when: ["todo", "ready", "blocked"] },
  { key: "done", label: "Mark done", variant: "filled", color: "green", when: ["doing"] },
  { key: "fail", label: "Fail", variant: "outline", color: "red", when: ["doing"] },
  { key: "block", label: "Block", variant: "default", when: ["doing", "ready", "todo"] },
  { key: "unblock", label: "Unblock", variant: "default", when: ["blocked"] }
]
export function ItemModal({ open, onClose, item, onRefresh, onOpenSub }: {
  open: boolean; onClose: () => void
  item: WorkItem | undefined; onRefresh: () => Promise<void>; onOpenSub: (id: string) => void
}): JSX.Element | null {
  const [busy, setBusy] = useState("")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const go = async (kind: string): Promise<void> => {
    if (!item) return
    setBusy(kind)
    setMsg(null)
    let r: ActionResult
    try {
      switch (kind) {
        case "start": r = await api.act("start", item.itemId, { executorId: "console" }); break
        case "done": r = await api.act("done", item.itemId, { detail: "completed from web panel" }); break
        case "fail": r = await api.act("fail", item.itemId, { detail: "failed from web panel" }); break
        case "cancel": r = await api.act("cancel", item.itemId); break
        case "block": r = await api.act("block", item.itemId, { reason: "blocked from web panel" }); break
        case "unblock": r = await api.act("unblock", item.itemId); break
        case "coordinate": r = await api.coordinate(item.itemId); break
        default: r = { ok: false, detail: "unknown action" }
      }
    } catch (e) { r = { ok: false, detail: String(e) } }
    if (r.ok === false) setMsg({ ok: false, text: r.detail ?? "request failed" })
    else setMsg({ ok: true, text: r.detail ?? r.summary ?? "ok" })
    setBusy("")
    await onRefresh()
  }
  if (!item) return null
  const terminal = ["done", "failed", "cancelled"].includes(item.state)
  return (
    <Modal opened={open} onClose={onClose} size={620} title={
      <Group gap={8} wrap="nowrap"><Badge size="xs" variant="light" color={stateColor(item.state)}>{item.state}</Badge><Text size="sm" fw={650} truncate style={{ maxWidth: 420 }}>{item.title}</Text></Group>
    }>
      <Stack gap="xs">
        <div className="kv">
          <span className="k">id</span><span className="v mono">{item.itemId}</span>
          <span className="k">priority</span><span className="v">{prioLevel(item.priority) || "normal"}</span>
          <span className="k">assignee</span><span className="v">{item.assigneeId || "—"}</span>
        </div>
        <When c={!!item.body}><Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{item.body}</Text></When>
        <When c={!!item.blockedReason}>
          <Text size="xs" c="orange">blocked: {item.blockedReason}</Text>
        </When>
        <When c={!!item.result}><Text size="xs" c="dimmed">result: {item.result}</Text></When>
        <Divider />
        <When c={(item.requires?.length ?? 0) > 0}>
          <Group gap={6}>
            <Text size="xs" c="dimmed">claims:</Text>
            {(item.requires ?? []).map((c, i) => (
              <Badge key={i} size="xs" variant="outline">{c.resourceId}{c.amount && c.amount > 1 ? " ×" + c.amount : ""}</Badge>
            ))}
          </Group>
        </When>
        <When c={(item.dependencies?.length ?? 0) > 0}>
          <Group gap={6}>
            <Text size="xs" c="dimmed">waits on:</Text>
            {(item.dependencies ?? []).map((d) => <button key={d} className="ref" onClick={() => onOpenSub(d)}>{d}</button>)}
          </Group>
        </When>
        <When c={(item.children?.length ?? 0) > 0}>
          <Group gap={6}>
            <Text size="xs" c="dimmed">subtasks:</Text>
            {(item.children ?? []).map((d) => <button key={d} className="ref" onClick={() => onOpenSub(d)}>{d}</button>)}
          </Group>
        </When>
        <When c={!terminal}>
          <Divider />
          <Group gap={6} wrap="wrap">
            {ACTIONS.filter((a) => a.when.includes(item.state)).map((a) => (
              <Button key={a.key} size="xs" variant={a.variant} color={a.color}
                loading={busy === a.key} disabled={busy !== "" && busy !== a.key}
                onClick={() => void go(a.key)}>{a.label}</Button>
            ))}
            <Button size="xs" variant="subtle" loading={busy === "coordinate"} disabled={busy !== "" && busy !== "coordinate"}
              onClick={() => void go("coordinate")}>Break down with coordinator…</Button>
            <Button size="xs" variant="outline" color="red" loading={busy === "cancel"} disabled={busy !== "" && busy !== "cancel"}
              onClick={() => void go("cancel")}>Cancel</Button>
          </Group>
        </When>
        <When c={!!msg}>
          <Text size="sm" c={msg?.ok ? "green" : "red"}>{msg?.ok ? "✓ " : "✗ "}{msg?.text ?? ""}</Text>
        </When>
      </Stack>
    </Modal>
  )
}
