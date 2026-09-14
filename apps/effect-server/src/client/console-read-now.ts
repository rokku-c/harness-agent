/**
 * One press of `r`, and every source on the screen reads again.
 *
 * The signal is raised on the window rather than passed through React context,
 * and that is forced rather than convenient: an app's declared view is mounted
 * in a React root of its own (`effect-ui-client.tsx`), so the sources it reads
 * are outside any context the shell can provide. A window event is the one
 * channel both roots share, and it is the same channel a `keydown` arrives on.
 *
 * What the press means is "read again, now" and not "reload the page": the
 * readers keep the value they already had and the freshness marker says when the
 * last read succeeded (`console-source.ts`), so a re-read never blanks the rows
 * under the operator's cursor.
 */

import * as React from "react"

/** Raised on the window when the operator asks for the current screen's sources to be read again. */
const READ_NOW = "effect-console-read-now"

export const readNow = (): void => { window.dispatchEvent(new CustomEvent(READ_NOW)) }

/**
 * How many times the operator has asked, so a reader can put it in its
 * dependencies. A count and not a flag: two presses are two reads, which is what
 * an operator pressing it twice means.
 */
export const useReadNow = (): number => {
  const [count, setCount] = React.useState(0)
  React.useEffect(() => {
    const onRead = (): void => setCount((value) => value + 1)
    window.addEventListener(READ_NOW, onRead)
    return () => window.removeEventListener(READ_NOW, onRead)
  }, [])
  return count
}
