/** Pending approvals: an operator gate card per waiting call */
import { type JSX } from "react"
import { Badge, Button, Code, Group, Paper, Stack, Text } from "@mantine/core"
import { IconCheck, IconX } from "@tabler/icons-react"
import { panel, usePanel } from "../store.ts"
import { shortId } from "../common.ts"

export const ApprovalsView = (): JSX.Element => {
  const state = usePanel()
  const pending = state.pending
  return (
    <Stack p="md" gap="sm" style={{ height: "100%", overflow: "auto" }}>
      {!state.approvalsOn && pending.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" style={{ marginTop: 40 }}>
          本实例未启用审批门：agent 写操作直接执行。
        </Text>
      )}
      {state.approvalsOn && pending.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" style={{ marginTop: 40 }}>
          暂无待批请求——需要放行时会在这里出现卡片。
        </Text>
      )}
      {pending.map((p) => (
        <Paper key={p.callId} p="sm" radius="md" withBorder style={{ maxWidth: 640, alignSelf: "center", width: "100%" }}>
          <Group justify="space-between" mb={6}>
            <Group gap={6}>
              <Badge size="xs" variant="light" color="yellow">{p.tool}</Badge>
              <Text size="xs" c="dimmed" style={{ fontFamily: "var(--mantine-font-family-monospace)" }}>{shortId(p.callId)}</Text>
              {p.session !== undefined && p.session !== "" && (
                <Text size="xs" c="dimmed">来自会话 <b>{p.session}</b></Text>
              )}
            </Group>
            <Text size="xs" c="dimmed">等待操作者</Text>
          </Group>
          <Code block style={{ fontSize: 11, maxHeight: 180, overflow: "auto" }}>
            {JSON.stringify(p.input, null, 2)}
          </Code>
          <Group justify="flex-end" mt={8}>
            <Button color="red" variant="light" size="compact-sm" leftSection={<IconX size={13} />} onClick={() => void panel.resolveApproval(p.callId, false)}>
              拒绝
            </Button>
            <Button size="compact-sm" leftSection={<IconCheck size={13} />} onClick={() => void panel.resolveApproval(p.callId, true)}>
              同意
            </Button>
          </Group>
        </Paper>
      ))}
    </Stack>
  )
}
