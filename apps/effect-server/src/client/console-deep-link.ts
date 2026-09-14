/**
 * `Mod+Shift+C`: exactly what is on screen, as a link.
 *
 * `window.location.href` and not the hash, because the link is going somewhere:
 * a colleague who is handed `#app/board/task?taskId=t-3` alone has to be told
 * which host to paste it into, and the address that carries the origin is the one
 * that works when pasted. It is also the exact address the operator is on, which
 * is what makes the copy honest — nothing here composes a link the console does
 * not already answer.
 *
 * The clipboard is not available everywhere (an insecure origin has no
 * `navigator.clipboard` at all), and a copy that could not happen is reported as
 * `false` rather than thrown: the console's live region announces the four things
 * §6.2 rule 6 lists and a copy is not one of them, so the caller's choice is to
 * say nothing, and a rejected promise would say something else entirely.
 */

/** The address of what is on screen, origin and all. */
export const deepLink = (): string => window.location.href

export const copyDeepLink = async (): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(deepLink())
    return true
  } catch {
    return false
  }
}
