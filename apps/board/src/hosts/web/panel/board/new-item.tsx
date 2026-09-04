/** panel/board/new-item.tsx - the NEW WORK ITEM modal.
 *  Concept: one form -> one api.createItem call (claims + dependencies are
 *  comma-separated id lists, split client-side); create then refreshes. */
import { type JSX, useState } from "react"
import { Button, Group, Modal, Select, Stack, Text, TextInput, Textarea } from "@mantine/core"
import { api } from "../api.ts"
import { When } from "./helpers.tsx"

export function splitList(s: string): string[] { return s.split(",").map((x) => x.trim()).filter(Boolean) }

export function NewItemModal({ open, onClose, onRefresh }: { open: boolean; onClose: () => void; onRefresh: () => Promise<void> }): JSX.Element {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [prio, setPrio] = useState<string | null>("normal")
  const [req, setReq] = useState("")
  const [dep, setDep] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const reset = (): void => { setTitle(""); setBody(""); setPrio("normal"); setReq(""); setDep(""); setErr(null) }
  const close = (): void => { reset(); onClose() }
  const create = async (): Promise<void> => {
    if (!title.trim()) { setErr("title is required"); return }
    setBusy(true); setErr(null)
    const r = await api.createItem({
      title: title.trim(), body: body.trim() || undefined, priority: prio ?? "normal",
      requires: splitList(req).map((resourceId) => ({ resourceId })),
      dependencies: splitList(dep)
    })
    setBusy(false)
    if (r.ok === false) setErr(r.detail ?? "create failed")
    else { await onRefresh(); close() }
  }
  return (
    <Modal opened={open} onClose={close} size={520} title="New work item">
      <Stack gap="sm">
        <TextInput label="Title" required placeholder="what needs to happen?" value={title} onChange={(e) => setTitle(e.currentTarget.value)} data-autofocus />
        <Textarea label="Description" rows={3} value={body} onChange={(e) => setBody(e.currentTarget.value)} />
        <Group grow gap="xs">
          <Select label="Priority" data={["normal", "low", "high", "urgent"]} value={prio} onChange={setPrio} />
        </Group>
        <TextInput label="Requires resource ids (comma-separated)" placeholder="workspace-1, gpu" value={req} onChange={(e) => setReq(e.currentTarget.value)} />
        <TextInput label="Depends on item ids (comma-separated)" placeholder="leave empty" value={dep} onChange={(e) => setDep(e.currentTarget.value)} />
        <When c={!!err}><Text size="sm" c="red">{err}</Text></When>
        <Group justify="flex-end" gap="xs" mt="xs">
          <Button size="xs" variant="default" onClick={close}>Cancel</Button>
          <Button size="xs" loading={busy} onClick={() => void create()}>Create item</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
