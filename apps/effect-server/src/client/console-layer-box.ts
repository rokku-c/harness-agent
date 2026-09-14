/**
 * Where a layer sits, in one place, because two layers must not drift apart.
 *
 * §10.3 gives the palette its geometry: anchored at 12 vh rather than centred, a
 * width that stops at 560 px and steps in on a narrow viewport, the solid panel
 * colour, the fifth radius and the third shadow. The shortcut sheet is anchored
 * by the same numbers on purpose — `?` and `Mod+K` are the same kind of moment
 * for the reader, and a sheet that appeared somewhere else would read as a
 * different kind of thing.
 *
 * It is inline rather than in the stylesheet for the reason the design gives:
 * Radix lays a dialog out itself, and no stylesheet order can be relied on to
 * move it off the anchor it computes.
 */

import type * as React from "react"

export const LAYER_BOX: React.CSSProperties = {
  position: "fixed",
  top: "12vh",
  left: "50%",
  transform: "translateX(-50%)",
  width: "min(560px, calc(100vw - 32px))",
  maxWidth: "none",
  background: "var(--color-panel-solid)",
  borderRadius: "var(--radius-5)",
  boxShadow: "var(--shadow-3)",
}
