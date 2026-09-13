/**
 * effect-interface/surface - one declaration, every surface.
 *
 * Write an operation once and project it: `toEffectTools` for MCP (or any tool
 * transport), `toHttpHandler` for REST. Both validate with the operation's own
 * schema, so an argument a tool call refuses is the same argument an HTTP
 * request refuses, with the same message.
 */
export * from "./operation.ts"
export * from "./fields.ts"
export * from "./match.ts"
export * from "./http.ts"
export * from "./tools.ts"
