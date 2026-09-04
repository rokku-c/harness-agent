/**
 * Barrel: the model catalog split by CONCEPT (see ./catalog/).
 * contract.ts = types + service tag; resolve.ts = env tree resolution;
 * load.ts = TOML document -> ModelCatalog service/layer.
 */
export type { ProviderConfig, ModelCatalogService } from "./catalog/contract.ts"
export { ProviderConfigError, ModelCatalog } from "./catalog/contract.ts"
export { parseEnv, resolveTree } from "./catalog/resolve.ts"
export type { LoadModelCatalogOptions } from "./catalog/load.ts"
export { ModelCatalogImpl, loadModelCatalog, ModelCatalogLayer } from "./catalog/load.ts"
