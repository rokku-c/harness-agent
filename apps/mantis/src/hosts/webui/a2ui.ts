/**
 * Barrel: the A2UI v0.9 message layer split by CONCEPT (see ./a2ui/).
 * types.ts = message contract + validation; catalog.ts = official basic
 * catalog schemas; repairs.ts = targeted habit repairs; degrade.ts =
 * visible degradation; sanitize.ts = one-component sanitize; root.ts =
 * surface root normalization; parse.ts = batch parsing.
 */
export { A2UI_BASIC_CATALOG } from "./a2ui/types.ts"
export type { A2uiCreateSurface, A2uiUpdateComponents, A2uiUpdateDataModel, A2uiDeleteSurface, A2uiMessage } from "./a2ui/types.ts"
export { surfaceIdOfBatch } from "./a2ui/types.ts"
export { sanitizeComponent } from "./a2ui/sanitize.ts"
export { ensureSurfaceRoot } from "./a2ui/root.ts"
export type { ParseResult } from "./a2ui/parse.ts"
export { parseA2uiBatch } from "./a2ui/parse.ts"
