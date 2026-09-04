/** views/workspace/resource-paper.tsx - one RESOURCE KIND as a card.
 *  Concept: rendered GENERICALLY from the resource declaration snapshot
 *  (workspace.ts): label, write name/description + records - no per-resource code. */
import { type JSX, useState } from "react"
import { ActionIcon, Badge, Button, Group, Paper, Stack, Text, TextInput } from "@mantine/core"
import { IconCheck, IconEdit, IconSend, IconTrash, IconX } from "@tabler/icons-react"
import { fmtTime } from "../../common.ts"
import type { WorkspaceRecord, WorkspaceResource, WorkspaceSnap } from "../../api.ts"

export const ResourcePaper = ({
  resource, shown, filterLabel,
  editing, rowBusy, draftBusy,
  onEditText, onSave, onCancel, onDelete, onAdd
}: {
  resource: WorkspaceResource
  shown: WorkspaceRecord[]
  filterLabel: string
  editing: Readonly<Record<string, string | undefined>>
  rowBusy: Readonly<Record<string, boolean>>
  draftBusy: boolean
  onEditText: (id: string, value: string) => void
  onSave: (id: string) => void
  onCancel: (id: string) => void
  onDelete: (id: string) => void
  onAdd: (kind: string, text: string) => Promise<boolean>
}): JSX.Element => {
  const [draft, setDraft] = useState("")
  return (
    <Paper data-kind={resource.kind} p="sm" radius="md" withBorder style={{ maxWidth: 720, width: "100%" }}>
      <Group justify="space-between" mb={4}>
        <Group gap={8}>
          <Text fw={600} size="sm" tt="capitalize">{resource.label}</Text>
          <Badge size="xs" variant="light">{resource.write.name}</Badge>
        </Group>
        <Text size="xs" c="dimmed">{shown.length}/{resource.records.length} shown</Text>
      </Group>
      <Text size="xs" c="dimmed" mb="xs">{resource.write.description}</Text>
      <Stack gap={4} mb="xs">
        {resource.records.length === 0 && <Text size="xs" c="dimmed">(空)</Text>}
        {shown.length === 0 && resource.records.length > 0 && <Text size="xs" c="dimmed">(没有 {filterLabel} 写的内容)</Text>}
        {shown.slice(-30).reverse().map((record) => {
          const isEditing = editing[record.id] !== undefined
          const busy = rowBusy[record.id] === true
          return (
          <Group key={record.id} gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
            <Text size="xs" c="dimmed" style={{ flex: "none" }}>{fmtTime(record.ts)}</Text>
            {isEditing ? (
              <TextInput
                size="xs"
                style={{ flex: 1, minWidth: 120 }}
                value={editing[record.id] ?? record.text}
                autoFocus
                disabled={busy}
                onChange={(event) => onEditText(record.id, event.currentTarget.value)}
                onKeyDown={(event) => { if (event.key === "Enter") onSave(record.id); if (event.key === "Escape") onCancel(record.id) }}
              />
            ) : (
              <Text size="sm" style={{ minWidth: 0, flex: 1 }}>{record.text}</Text>
            )}
            {record.source === "ui" && <Badge size="xs" variant="outline" c="dimmed" style={{ flex: "none" }}>ui</Badge>}
            {record.source === "agent" && <Badge size="xs" variant="outline" color="teal" style={{ flex: "none" }}>agent</Badge>}
            {isEditing ? (
              <>
                <ActionIcon size="sm" variant="subtle" color="green" loading={busy} title="save" aria-label="save edit" onClick={() => onSave(record.id)}><IconCheck size={14} /></ActionIcon>
                <ActionIcon size="sm" variant="subtle" title="cancel" aria-label="cancel edit" disabled={busy} onClick={() => onCancel(record.id)}><IconX size={14} /></ActionIcon>
              </>
            ) : (
              <>
                <ActionIcon size="sm" variant="subtle" title="edit" aria-label={"edit " + record.id} disabled={busy} onClick={() => onEditText(record.id, record.text)}><IconEdit size={14} /></ActionIcon>
                <ActionIcon size="sm" variant="subtle" color="red" title="delete" aria-label={"delete " + record.id} loading={busy} onClick={() => onDelete(record.id)}><IconTrash size={14} /></ActionIcon>
              </>
            )}
          </Group>
          )
        })}
      </Stack>
      <Group gap={6}>
        <TextInput
          size="xs"
          flex={1}
          placeholder={"记一条 " + resource.label + "…"}
          value={draft}
          disabled={draftBusy}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => { if (event.key === "Enter") void submitAdd() }}
        />
        <Button size="compact-sm" leftSection={<IconSend size={13} />} loading={draftBusy} onClick={() => void submitAdd()}>
          添加
        </Button>
      </Group>
    </Paper>
  )
  async function submitAdd(): Promise<void> {
    const text = draft.trim()
    if (text === "") return
    const ok = await onAdd(resource.kind, text)
    if (ok) setDraft("")
  }
}
