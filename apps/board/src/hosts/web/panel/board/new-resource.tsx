/** panel/board/new-resource.tsx - the NEW RESOURCE modal.
 *  Concept: one form -> one api.createResource call (kind + concurrency are
 *  selects, capacity a number); create then refreshes. */
import { type JSX, useState } from "react"
import { Button, Group, Modal, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core"
import { api } from "../api.ts"
import { When } from "./helpers.tsx"

export function NewResourceModal({ open, onClose, onRefresh }: { open: boolean; onClose: () => void; onRefresh: () => Promise<void> }): JSX.Element {
  const [resourceId, setResourceId] = useState("")
  const [name, setName] = useState("")
  const [kind, setKind] = useState<string | null>("workspace")
  const [cap, setCap] = useState<number | string>(1)
  const [conc, setConc] = useState<string | null>("exclusive")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const reset = (): void => { setResourceId(""); setName(""); setKind("workspace"); setCap(1); setConc("exclusive"); setErr(null) }
  const close = (): void => { reset(); onClose() }
  const create = async (): Promise<void> => {
    const id = resourceId.trim()
    if (!id) { setErr("resource id is required"); return }
    setBusy(true); setErr(null)
    const r = await api.createResource({
      resourceId: id, kind: kind ?? "workspace", name: name.trim() || id,
      capacity: Number(cap) || 1, concurrency: conc ?? "exclusive"
    })
    setBusy(false)
    if (r.ok === false) setErr(r.detail ?? "create failed")
    else { await onRefresh(); close() }
  }
  return (
    <Modal opened={open} onClose={close} size={460} title="New resource">
      <Stack gap="sm">
        <TextInput label="Resource id" required placeholder="workspace-1" value={resourceId} onChange={(e) => setResourceId(e.currentTarget.value)} data-autofocus />
        <TextInput label="Display name" placeholder="defaults to the id" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <Group grow gap="xs">
          <Select label="Kind" data={["workspace", "slot", "external"]} value={kind} onChange={setKind} />
          <Select label="Concurrency" data={["exclusive", "shared"]} value={conc} onChange={setConc} />
        </Group>
        <NumberInput label="Capacity" min={1} value={cap} onChange={setCap} />
        <When c={!!err}><Text size="sm" c="red">{err}</Text></When>
        <Group justify="flex-end" gap="xs" mt="xs">
          <Button size="xs" variant="default" onClick={close}>Cancel</Button>
          <Button size="xs" loading={busy} onClick={() => void create()}>Create resource</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
