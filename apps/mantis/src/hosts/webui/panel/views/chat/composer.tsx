/** views/chat/composer.tsx - the MESSAGE COMPOSER.
 *  Concept: Enter sends (IME composition is respected), Shift+Enter is a
 *  newline; while a send is in flight the button disables so one turn per
 *  click. The busy rejection (same conversation has a running turn) comes
 *  back as a local note from the store - the composer never retries. */
import { type JSX, useState } from "react"
import { Button, Textarea } from "@mantine/core"
import { IconSend } from "@tabler/icons-react"
import { panel } from "../../store.ts"

export const Composer = ({ effective }: { effective: string }): JSX.Element => {
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const submit = async (): Promise<void> => {
    const text = draft.trim()
    if (text.length === 0 || sending) return
    panel.selectConversation(effective)
    setDraft("")
    setSending(true)
    try { await panel.send(text) } finally { setSending(false) }
  }
  return (
    <div style={{ padding: "8px 10px", borderTop: "1px solid var(--mantine-color-gray-2)", display: "flex", gap: 8, alignItems: "flex-end", flex: "none" }}>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.currentTarget.value)}
        placeholder="给 mantis 派活…（Enter 发送）"
        autosize minRows={1} maxRows={4}
        style={{ flex: 1 }}
        styles={{ input: { fontSize: 13, paddingTop: 6 } }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit() }
        }}
      />
      <Button onClick={() => void submit()} disabled={sending || draft.trim().length === 0} aria-label="send">
        <IconSend size={13} style={{ marginRight: 5 }} /> 发送
      </Button>
    </div>
  )
}
