/**
 * @effect-agent/effect-ui — the UI declaration layer vs rendering layer seam.
 *
 * An effect app declares ONLY an EffectUiView contract (spec.ts) — a closed
 * union of declarative nodes exportable as JSON Schema (schema.ts) — and
 * renders it through a UiRenderer picked by id (renderer.ts). Renderers are
 * swappable: htmlRenderer emits standalone HTML, while effectUiWebRenderer
 * bridges the same view into the repo's ui-* declaration/render pipeline.
 */

export * from "./spec.ts"
export * from "./schema.ts"
export * from "./renderer.ts"
export * from "./html-renderer.ts"
export * from "./web-bridge.ts"
export * from "./form.ts"
export * from "./json-spec.ts"
export * from "./form-spec.ts"
export * from "./form-catalog.ts"
export * from "./role-spec.ts"
export * from "./role-recipes.ts"
export * from "./style-layer.ts"
export * from "./document.ts"
export * from "./contract.ts"
export * from "./projector.ts"
export * from "./tokenizer.ts"
export * from "./refresh.ts"
export * from "./ui.ts"
export * from "./role-registry.ts"
