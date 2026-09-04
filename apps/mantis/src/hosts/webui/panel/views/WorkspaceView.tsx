/** The human side of the workspace, rendered GENERICALLY from the resource
 *  declaration snapshot; each kind renders through ./workspace/resource-paper.tsx. */
import { useCallback, useEffect, useState, type JSX } from "react"
import { ActionIcon, Group, SegmentedControl, Stack, Text } from "@mantine/core"
import { IconRefresh } from "@tabler/icons-react"
import { api, type WorkspaceSnap } from "../api.ts"
import { ResourcePaper } from "./workspace/resource-paper.tsx"
export const WorkspaceView = (): JSX.Element => {
  const [snap, setSnap] = useState<WorkspaceSnap | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  /** record row being edited (id -> draft text) - generic for every kind */
  const [editing, setEditing] = useState<Record<string, string | undefined>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  /** provenance filter over the shared records (client-side over the snapshot) */
  const [sourceFilter, setSourceFilter] = useState<"all" | "ui" | "agent">("all")

  const load = useCallback(() => {
    void api.workspace().then((value) => {
      setSnap(value)
      setError(undefined)
    }).catch(() => setError("工作区暂不可用"))
  }, [])
  useEffect(() => { load() }, [load])
  const beginEdit = (id: string, text: string): void => setEditing((e) => ({ ...e, [id]: text }))
  const saveEdit = (id: string): void => {
    const text = (editing[id] ?? "").trim()
    if (text === "") { setEditing((e) => ({ ...e, [id]: undefined })); return }
    setBusy((b) => ({ ...b, [id]: true }))
    void api.workspaceUpdate(id, text).then((result) => {
      if (!result.ok) { setError(result.detail ?? "update failed"); return }
      load()
    }).catch(() => setError("update failed")).finally(() => {
      setBusy((b) => ({ ...b, [id]: false }))
      setEditing((e) => ({ ...e, [id]: undefined }))
    })
  }
  const removeRecord = (id: string): void => {
    if (!window.confirm("删除这条记录？")) return
    setBusy((b) => ({ ...b, [id]: true }))
    void api.workspaceDelete(id).then((result) => {
      if (!result.ok) { setError(result.detail ?? "delete failed"); return }
      load()
    }).catch(() => setError("delete failed")).finally(() => setBusy((b) => ({ ...b, [id]: false })))
  }
  const add = async (kind: string, text: string): Promise<boolean> => {
    setBusy((b) => ({ ...b, [kind]: true }))
    try {
      const result = await api.workspaceAdd(kind, text)
      if (!result.ok) { setError(result.detail ?? "write failed"); return false }
      load()
      return true
    } catch {
      setError("write failed")
      return false
    } finally {
      setBusy((b) => ({ ...b, [kind]: false }))
    }
  }
  if (snap === undefined) return <Stack p="md" style={{ height: "100%", overflow: "auto" }}><Text size="sm" c="dimmed" ta="center" style={{ marginTop: 40 }}>{error ?? "加载工作区…"}</Text></Stack>
  return (
    <Stack p="md" gap="md" style={{ height: "100%", overflow: "auto" }}>
      <Group justify="space-between">
        <SegmentedControl
          size="xs"
          value={sourceFilter}
          onChange={(value) => setSourceFilter(value as "all" | "ui" | "agent")}
          data={[
            { value: "all", label: "全部" },
            { value: "ui", label: "操作者 (ui)" },
            { value: "agent", label: "Agent" }
          ]}
          aria-label="filter records by who wrote them"
        />
        <ActionIcon variant="light" size="sm" onClick={() => load()} title="refresh"><IconRefresh size={14} /></ActionIcon>
      </Group>
      {error !== undefined && <Text size="xs" c="red">{error}</Text>}
      {snap.resources.map((resource) => {
        const shown = sourceFilter === "all" ? resource.records : resource.records.filter((record) => (record.source ?? "agent") === sourceFilter)
        return (
        <ResourcePaper
          key={resource.kind}
          resource={resource}
          shown={shown}
          filterLabel={sourceFilter === "ui" ? "操作者" : "agent"}
          editing={editing}
          rowBusy={busy}
          draftBusy={busy[resource.kind] === true}
          onEditText={(id, value) => setEditing((e) => ({ ...e, [id]: value }))}
          onSave={saveEdit}
          onCancel={(id) => setEditing((e) => ({ ...e, [id]: undefined }))}
          onDelete={removeRecord}
          onAdd={add}
        />
        )
      })}
    </Stack>
  )
}
