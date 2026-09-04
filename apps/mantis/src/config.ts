/**
 * Barrel: mantis config split by CONCEPT (see ./config/).
 * types.ts = contract; discovery.ts = file discovery + env expansion;
 * legacy.ts = the old-key registry; audit.ts = deprecation warnings;
 * map.ts = derive new-engine values; load.ts = pipeline glue.
 */
export type { ModelApi, RobotAccess, DwsAccess, MantisConfig } from "./config/types.ts"
export { candidateConfigPaths, findConfigPath } from "./config/discovery.ts"
export { loadConfig } from "./config/load.ts"
