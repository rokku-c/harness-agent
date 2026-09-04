/**
 * Barrel: core uri split by CONCEPT (see ./uri/).
 * contract.ts = the UriScheme contract; ea.ts = the built-in scheme + Uri
 * conveniences; space.ts = the pluggable UriSpace container.
 */
export type { UriParts, UriScheme } from "./uri/contract.ts"
export { eaScheme, eaUri, Uri } from "./uri/ea.ts"
export { UriSpace, defaultUriSpace } from "./uri/space.ts"
