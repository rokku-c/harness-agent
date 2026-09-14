import type { ToolDef } from "./tool.ts"
export type Ref =
  | { readonly kind: "latest" }
  | { readonly kind: "revision"; readonly n: number }
  | { readonly kind: "hash"; readonly hash: string }
  | { readonly kind: "range"; readonly spec: string }

export interface Dep {
  readonly name: string
  readonly ref: Ref
}

export const refToShort = (ref: Ref): string => {
  switch (ref.kind) {
    case "latest": return "latest"
    case "revision": return "rev:" + ref.n
    case "hash": return ref.hash.slice(0, 8)
    case "range": return ref.spec
  }
}

export interface Version {
  readonly tool: string
  readonly revision: number
  readonly hash: string
  readonly parent?: string
  readonly message: string
  readonly content: ToolDef
  readonly createdAt: number
  readonly hidden?: boolean
}

export type VersionVisibility = "public" | "hidden" | "restricted"
