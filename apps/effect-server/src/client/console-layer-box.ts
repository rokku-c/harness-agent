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
