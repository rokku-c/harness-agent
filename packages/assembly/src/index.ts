/**
 * @effect-agent/assembly — cross-cutting assembly layer (composition root)
 *
 * Assembles each layer's Layer into a runnable instance: defaultLayers()
 * (default composition works out of the box) and driver() (the default loop
 * engine that takes the Model from the context). Depends on every package and
 * is used by apps/; this is the only place that knows all the seams.
 */
export * from "./options.ts"
export * from "./assembly.ts"
