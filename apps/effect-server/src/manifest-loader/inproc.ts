import { resolve } from "node:path"
import { registerEffectApp, type EffectAppDescriptor } from "@effect-agent/effect-apps"
import type { Discovered } from "../yaml-manifest.ts"
import type { Disposer, LoadContext } from "./types.ts"

/** One authoring contract only: no legacy export guessing or metadata probing. */
export const loadInproc = async (ctx: LoadContext, discovered: Discovered): Promise<Disposer> => {
  const m = discovered.manifest
  if (!m.module) throw new Error(`manifest ${m.id}: inproc needs module`)
  const mod = await import(resolve(discovered.dir, m.module)) as { effectApp?: EffectAppDescriptor }
  if (!mod.effectApp || mod.effectApp.id !== m.id) throw new Error(`manifest ${m.id}: expected a matching effectApp descriptor`)
  return registerEffectApp(ctx, mod.effectApp)
}
