import * as React from "react"

export type ActionHandlers = Readonly<Record<string, ((params?: Record<string, unknown>) => Promise<void>) | undefined>>

export const useScreenEnter = (
  handlers: ActionHandlers,
  screen: { readonly id: string; readonly onEnter?: string } | undefined,
  params: Readonly<Record<string, string>>,
): void => {
  const key = `${screen?.id ?? ""}?${new URLSearchParams(Object.entries(params)).toString()}`
  const name = screen?.onEnter
  React.useEffect(() => {
    if (name === undefined) return
    void handlers[name]?.()
  }, [handlers, name, key])
}
