/**
 * @effect-agent/effect-ui — the UI declaration layer vs rendering layer seam.
 *
 * An effect app declares ONLY an EffectUiView contract (spec.ts) — nodes that
 * name @radix-ui/themes components and export as JSON Schema (schema.ts) — and
 * renders it through a UiRenderer picked by id (renderer.ts), so the renderer is
 * the app's choice and this package ships one: htmlRenderer.
 */

export * from "./spec.ts"
export * from "./screen.ts"
export * from "./screen-derive.ts"
export * from "./screen-reads.ts"
export * from "./source-status.ts"
export * from "./readout.ts"
export * from "./empty-rows.ts"
export * from "./nodes.ts"
export * from "./region.ts"
export * from "./row.ts"
export * from "./data-spec.ts"
export * from "./value-spec.ts"
export * from "./schema.ts"
export * from "./renderer.ts"
export * from "./html-renderer.ts"
export * from "./form.ts"
export * from "./json-spec.ts"
export * from "./form-spec.ts"
export * from "./document.ts"
export * from "./contract.ts"
export * from "./pointer.ts"
export * from "./projector.ts"
export * from "./tokenizer.ts"
export * from "./ui.ts"
