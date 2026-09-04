/**
 * schema/spec.ts - document-building combinators (定义层 sugar). Helpers keep
 * screen builders free of JSX while every document stays a serializable JSON
 * tree under the hood.
 */
import type { SpecNode } from "./types.ts"

export const text = (id: string, text: string, props: Record<string, unknown> = {}): SpecNode => ({ id, type: "text", props: { ...props, text } })
export const badge = (id: string, text: string, props: Record<string, unknown> = {}): SpecNode => ({ id, type: "badge", props: { ...props, text } })
export const code = (id: string, text: string, props: Record<string, unknown> = {}): SpecNode => ({ id, type: "code", props: { ...props, text } })
export const button = (id: string, label: string, action: string, data: unknown, props: Record<string, unknown> = {}): SpecNode =>
  ({ id, type: "button", props: { ...props, text: label, action, data } })
export const paper = (id: string, children: ReadonlyArray<SpecNode>, props: Record<string, unknown> = {}): SpecNode =>
  ({ id, type: "paper", props, children })
export const row = (id: string, children: ReadonlyArray<SpecNode>, props: Record<string, unknown> = {}): SpecNode =>
  ({ id, type: "row", props, children })
export const col = (id: string, children: ReadonlyArray<SpecNode>, props: Record<string, unknown> = {}): SpecNode =>
  ({ id, type: "col", props, children })
