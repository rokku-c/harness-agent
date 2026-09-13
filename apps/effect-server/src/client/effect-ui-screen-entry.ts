/**
 * A screen that says how it is entered.
 *
 * A press that enters a screen can read the record on the way in — that is what
 * `opens` beside `url` is for — but a link pasted into the address bar has no
 * press behind it. So the screen names the action that fills it (`UiScreen.onEnter`)
 * and the host runs that one, once, when the screen becomes the one on top: the
 * pasted link and the press then take the same path, and a destination is
 * complete on arrival rather than a heading over nothing.
 *
 * After the parameters are in the store, never before: the action's declared
 * params read `/_nav/...`, which is exactly where a press would have put them at
 * runtime, so one declaration serves both. `useNavState` writes that in a layout
 * effect, and this runs in the pass after it.
 *
 * Keyed on the screen *and* the parameters it arrived with. A re-render is not a
 * second arrival — running the action again would fetch the record again on
 * every keystroke elsewhere in the view — while the same screen entered with
 * other parameters is a different arrival, and is read again.
 */

import * as React from "react"

/** What a view's actions are, as the host hands them to the renderer. */
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
