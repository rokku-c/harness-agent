export type Scalar = string | number | boolean | null
export type Json = Scalar | Json[] | { [key: string]: Json }

export interface BindingExpression { readonly kind: "path" | "template" | "computed"; readonly value: string }
export interface ActionRef { readonly action: string; readonly input?: Record<string, Json> }
export interface UIEvent { readonly eventId: string; readonly nodeId: string; readonly type: string; readonly actions?: ReadonlyArray<ActionRef> }
export interface UINode {
  readonly id: string
  readonly type: string
  readonly version?: string
  readonly props?: Record<string, Json>
  readonly bindings?: Record<string, BindingExpression>
  readonly children?: ReadonlyArray<string>
  readonly slots?: Record<string, ReadonlyArray<string>>
  readonly events?: Record<string, ReadonlyArray<ActionRef>>
  readonly slot?: string
}
export interface CanvasDefinition {
  readonly canvasId: string
  readonly title: string
  readonly nodes: Readonly<Record<string, UINode>>
  readonly rootNodeIds: ReadonlyArray<string>
  readonly version: number
  readonly parentCanvasId?: string
}
export interface ComponentDefinition {
  readonly type: string
  readonly version: string
  readonly category: "base" | "composite" | "canvas" | "extension"
  readonly propsSchema?: Json
  readonly slots?: ReadonlyArray<string>
  readonly template?: UINode
  readonly capabilities?: { readonly acceptsChildren?: boolean; readonly acceptsSlots?: boolean; readonly requiresParent?: boolean; readonly requiredProps?: ReadonlyArray<string> }
}
export interface ExtensionManifest {
  readonly name: string
  readonly version: string
  readonly components?: ReadonlyArray<string>
  readonly permissions: ReadonlyArray<"read:data" | "render" | "emit:event" | "execute:script">
}
export type UICommand =
  | { readonly kind: "create-canvas"; readonly canvasId: string; readonly title: string }
  | { readonly kind: "insert-node"; readonly canvasId: string; readonly node: UINode; readonly parentId?: string }
  | { readonly kind: "remove-node"; readonly canvasId: string; readonly nodeId: string }
  | { readonly kind: "patch-node"; readonly canvasId: string; readonly nodeId: string; readonly props: Record<string, Json>; readonly expectedVersion: number }
  | { readonly kind: "bind-node"; readonly canvasId: string; readonly nodeId: string; readonly key: string; readonly binding: BindingExpression; readonly expectedVersion: number }
  | { readonly kind: "link-canvas"; readonly canvasId: string; readonly nodeId: string; readonly targetCanvasId: string; readonly parentId?: string }
  | { readonly kind: "set-theme"; readonly theme: string }
  | { readonly kind: "set-renderer"; readonly renderer: string }
  | { readonly kind: "navigate"; readonly canvasId: string; readonly params?: Record<string, Json> }
  | { readonly kind: "set-data"; readonly path: string; readonly value: Json }
export * from "./errors.ts"
