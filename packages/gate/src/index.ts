/**
 * @effect-agent/gate — L4 approval layer
 *
 * Gate decision before a tool executes: AllowAll (default) / DenyWrites
 * (policy) / Manual (human confirmation). Hooks onto the driver's
 * execution chain (assembly wires it up); swapping the policy = swapping
 * the implementation.
 */
export * from "./gate.ts"
