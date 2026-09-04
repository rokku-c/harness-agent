/**
 * schema/types.ts - the DECLARATIVE console UI contract (定义层).
 *
 * A UI document is plain JSON: a tree of spec nodes whose {type} names an
 * entry in the renderer catalog (渲染层). Product screens BUILD a document
 * from state and hand it to the renderer - no JSX per document. Keeping
 * this layer in one place is what later lets the same document be rendered
 * by another skin or authored by a program (agent), not only by TSX.
 *
 * Props stay loose by design (unknown); the catalog decides what it honors.
 */
export interface SpecAction {
  /** which registered action fired (e.g. "allow" / "deny" / "send") */
  readonly name: string
  /** action payload (e.g. { callId }) - kept opaque to the spec */
  readonly data?: unknown
}

export type SpecType =
  | "text"      // label line (props: text, size, c, dimmed, mono, center, mt)
  | "badge"     // status chip (props: text, color, variant, size)
  | "code"      // block of monospace text (props: text, style)
  | "button"    // action trigger (props: label(text), action, data, color, variant, icon: "check"|"x")
  | "paper"     // hairline card (props: p, radius, withBorder, style)
  | "row"       // horizontal group (props: justify, gap, style)
  | "col"       // vertical stack (props: gap, style)
  | "divider"
  | "spacer"    // flex: 1 push

export interface SpecNode {
  /** stable id within the document (used as the React key) */
  readonly id: string
  readonly type: SpecType
  readonly props?: Record<string, unknown>
  /** nested nodes (row/col/paper content) */
  readonly children?: ReadonlyArray<SpecNode>
}

/** one page document: root node is a col */
export type SpecDoc = SpecNode
