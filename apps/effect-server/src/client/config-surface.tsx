import * as React from "react"
import { Button, Callout, Flex, Text } from "@radix-ui/themes"
import type { ConfigApi, ConfigState, SaveStrategy } from "./config-api.ts"
import type { ConfigMountFactory } from "./config-spec.ts"
import { describeConfigState } from "./config-state.ts"
import { makeConfigSession } from "./config-session.ts"

const TONE = { active: "green", pending: "amber", error: "red" } as const
const EDIT_HINT = "Unsaved changes; choose Save and Apply or Save for Restart."

const STRATEGIES: readonly SaveStrategy[] = ["apply", "restart"]

/**
 * One app's configuration: the server's own account of it, then the generated
 * form. The form mounts outside React, so its buttons are read from the node
 * rather than through a React handler — the same path for every control the
 * schema produced.
 */
export const ConfigSurface = ({ id, api, mountConfig }: {
  readonly id: string
  readonly api: ConfigApi
  readonly mountConfig: ConfigMountFactory
}) => {
  const [state, setState] = React.useState<ConfigState | undefined>(undefined)
  const [note, setNote] = React.useState<{ readonly message: string; readonly error: boolean }>({ message: "Loading configuration…", error: false })
  const form = React.useRef<HTMLDivElement>(null)
  const session = React.useRef<ReturnType<typeof makeConfigSession> | undefined>(undefined)

  React.useEffect(() => {
    const node = form.current
    if (node === null) return
    let live = true
    const made = makeConfigSession(api, id, { onState: setState, onNote: (message, error) => setNote({ message, error }), current: () => live })
    session.current = made
    const run = async () => {
      try { await made.reload(node, mountConfig); if (live) setNote({ message: "", error: false }) }
      catch (error) { if (live) setNote({ message: (error as Error).message, error: true }) }
    }
    const onClick = (event: Event) => {
      const target = event.target as HTMLElement
      const strategy = target.closest<HTMLButtonElement>("[data-strategy]")?.dataset.strategy
      if (strategy !== undefined && (STRATEGIES as readonly string[]).includes(strategy)) { event.preventDefault(); void made.action(node, mountConfig, strategy as SaveStrategy) }
    }
    const onEdit = () => { if (node.getAttribute("aria-busy") !== "true") setNote({ message: EDIT_HINT, error: false }) }
    node.addEventListener("click", onClick)
    node.addEventListener("input", onEdit)
    node.addEventListener("change", onEdit)
    void run()
    return () => {
      live = false
      session.current = undefined
      node.removeEventListener("click", onClick)
      node.removeEventListener("input", onEdit)
      node.removeEventListener("change", onEdit)
      made.dispose()
    }
  }, [id, api, mountConfig])

  const apply = () => { const node = form.current; if (node !== null) void session.current?.action(node, mountConfig, undefined, true) }

  const display = state === undefined ? undefined : describeConfigState(state)
  return <Flex direction="column" gap="4">
    {display === undefined ? null
      : <Callout.Root color={TONE[display.tone]} size="1">
          <Callout.Text>
            <Flex align="center" gap="3" wrap="wrap">
              <Text size="2" weight="medium">{display.label}</Text>
              <Text size="2">{display.detail}</Text>
              <Text size="1" color="gray">{display.revision}</Text>
              {display.canApply ? <Button size="1" variant="soft" onClick={apply}>Apply saved configuration</Button> : null}
            </Flex>
          </Callout.Text>
        </Callout.Root>}
    {note.message === "" ? null : <Text size="2" color={note.error ? "red" : "gray"}>{note.message}</Text>}
    <div ref={form} />
  </Flex>
}
