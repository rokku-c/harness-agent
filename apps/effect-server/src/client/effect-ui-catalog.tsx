import * as React from "react"
import { defineCatalog } from "@json-render/core"
import { schema } from "@json-render/react/schema"
import { defineRegistry } from "@json-render/react"
import { formComponents } from "@effect-agent/effect-ui"

const catalog = defineCatalog(schema, { components: formComponents, actions: {} })

export const { registry } = defineRegistry(catalog, {
  components: {
    Stack: ({ props, children }: { props: { direction?: string; gap?: number; role?: string }; children?: React.ReactNode }) => (
      <div
        data-ui="stack"
        data-dir={props.direction ?? "vertical"}
        style={{
          display: "flex",
          flexDirection: props.direction === "horizontal" ? "row" : "column",
          flexWrap: "wrap",
          gap: props.gap ?? 8,
          width: "100%",
        }}
      >
        {children}
      </div>
    ),
    Text: ({ props }: { props: { value?: string } }) => <div style={{ color: "#111" }}>{props.value ?? ""}</div>,
    Button: ({ props }: { props: { label?: string } }) => (
      <button style={btnStyle}>{props.label ?? "ok"}</button>
    ),
    Input: ({ props }: { props: { label?: string; value?: string; placeholder?: string } }) => (
      <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 120 }}>
        {props.label !== undefined && <span style={{ fontSize: 12, color: "#333" }}>{props.label}</span>}
        <input data-field={props.label ?? ""} defaultValue={props.value ?? ""} placeholder={props.placeholder ?? ""} style={inputStyle} />
      </label>
    ),
  },
})

const btnStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #d9d6cf",
  background: "#fff",
  color: "#111",
  font: "inherit",
  cursor: "pointer",
}
const inputStyle: React.CSSProperties = {
  font: "inherit",
  border: "1px solid #d9d6cf",
  borderRadius: 6,
  padding: "6px 8px",
}

