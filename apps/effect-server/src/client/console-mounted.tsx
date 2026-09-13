import * as React from "react"
import { Callout } from "@radix-ui/themes"
import type { OpenPanel } from "./console-surfaces.ts"

/**
 * Hosts a surface that mounts its own React root — a declarative view, or a
 * config form — and owns its lifetime: when the route changes this unmounts and
 * the surface's late work is dropped rather than painted over the new route.
 *
 * The mount point is a link in the screen chain: on an app route it is given the
 * area the chrome left so a view can fill it, and on a document route the class
 * is inert, since a percentage height against an auto-height parent is `auto`.
 * A surface that failed still shows its error above the mount, and the two
 * together simply scroll in `.shell-body` as they always did.
 */
export const MountedSurface = ({ id, open }: { readonly id: string; readonly open: OpenPanel }) => {
  const ref = React.useRef<HTMLDivElement>(null)
  const [error, setError] = React.useState<string | undefined>(undefined)
  React.useEffect(() => {
    const node = ref.current
    if (node === null) return
    let live = true
    let close: (() => void) | undefined
    setError(undefined)
    void open(node, id, () => live).then(
      (dispose) => { if (live) close = dispose; else dispose() },
      (cause: Error) => { if (live) setError(cause.message) },
    )
    // the surface owned a root with its own timers; if it lands after the reader
    // has moved on, dispose it here instead of leaving it polling
    return () => { live = false; close?.() }
  }, [id, open])
  return <>
    {error === undefined ? null : <Callout.Root color="red" mb="3"><Callout.Text>{error}</Callout.Text></Callout.Root>}
    <div className="view-fill" ref={ref} />
  </>
}
