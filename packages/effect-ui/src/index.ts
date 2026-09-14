/**
 * @effect-agent/effect-ui — the UI declaration layer.
 *
 * An effect app declares ONLY an EffectUiView contract (spec.ts) — nodes that
 * name @radix-ui/themes components and export as JSON Schema (schema.ts) — and
 * the host lowers that declaration to the input its renderer consumes
 * (json-spec.ts for a view, form-spec.ts for a config form).
 *
 * This package ships no renderer. Lowering a declaration stays server-side so
 * the renderer's dependency stays out of the browser bundle; the one renderer
 * that draws a lowered spec is the console's, behind the adaptation layer.
 */

export * from "./spec.ts"
export * from "./screen-spec.ts"
export * from "./screen.ts"
export * from "./screen-derive.ts"
export * from "./screen-reads.ts"
export * from "./source-status.ts"
export * from "./readout.ts"
export * from "./nodes.ts"
export * from "./tone.ts"
export * from "./empty-rows.ts"
export * from "./press.ts"
export * from "./region.ts"
export * from "./row.ts"
export * from "./data-spec.ts"
export * from "./value-spec.ts"
export * from "./schema.ts"
export * from "./json-spec.ts"
export * from "./form-spec.ts"
export * from "./form/types.ts"
export * from "./form/model.ts"
export * from "./form/parse.ts"
export * from "./contract.ts"
export * from "./pointer.ts"
export * from "./projector.ts"
export * from "./tokenizer.ts"
