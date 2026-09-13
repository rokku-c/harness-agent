/**
 * The shipped kernel (docs/architecture-rework.md §6.1, §6.3-①).
 *
 * `createKernel` is the artifact contract's only implementation here, and the one
 * the bootstrap falls back to when the artifact repo has no kernel directory. A
 * kernel pushed to the repo (P6) exports the same function from its own directory,
 * which is why "swap to the artifact" and "swap to the shipped kernel" are the same
 * code path — §6.2 promised the switch would not change, and this is where that
 * promise is kept or broken.
 */

import type { LoadedPlane } from "@effect-agent/effect-host"
import { KERNEL_PLANES, planeIsOn } from "./slots.ts"
import type { KernelContext, KernelInstance } from "./types.ts"
import { pluginFor } from "./planes.ts"

export * from "./types.ts"
export * from "./slots.ts"
export { pluginFor } from "./planes.ts"

/** Best-effort stop of one plane; a failing stop must not hide the original failure. */
const stopQuietly = async (plane: LoadedPlane | undefined): Promise<void> => {
  try { await plane?.stop?.() } catch { /* retain the original failure */ }
}

export const createKernel = async (context: KernelContext): Promise<KernelInstance> => {
  const specs = KERNEL_PLANES.filter((spec) => planeIsOn(spec, context.enabled))
  const planes = new Map<string, LoadedPlane>()
  const id = context.revision === undefined
    ? "io.effect-agent.effect-server@0.0.0"
    : `${context.revision.kernelId}#${context.revision.revision}`

  const start = async (planeId: string): Promise<void> => {
    if (planes.has(planeId)) return
    if (!specs.some((spec) => spec.id === planeId)) {
      throw new Error(`effect-server: ${planeId} is not a slot this kernel fills`)
    }
    planes.set(planeId, await pluginFor(planeId, context).load())
  }

  const stop = async (planeId: string): Promise<void> => {
    const plane = planes.get(planeId)
    if (plane === undefined) return
    planes.delete(planeId)
    await plane.stop?.()
  }

  /** Stop everything, newest plane first; the map is emptied either way. */
  const dispose = async (): Promise<void> => {
    for (const planeId of [...planes.keys()].reverse()) {
      const plane = planes.get(planeId)
      planes.delete(planeId)
      await stopQuietly(plane)
    }
  }

  try {
    // Eager: a kernel that cannot build a plane it claims to fill must fail at
    // stage time, while the old kernel is still serving — never on the first request.
    for (const spec of specs) await start(spec.id)
  } catch (error) {
    await dispose()
    throw error
  }

  return {
    id,
    planes,
    start,
    stop,
    health: async () => {
      for (const spec of specs) {
        if (!planes.has(spec.id)) throw new Error(`kernel ${id}: plane ${spec.id} is not loaded`)
      }
      // The config plane is the one surface every kernel must answer on; a kernel
      // that cannot list its declarations is not a kernel that can serve apps.
      const config = planes.get("config")
      if (config === undefined) return
      const response = await config.handle(new Request("http://effect/-/config"))
      if (!response.ok) throw new Error(`kernel ${id}: /-/config answered ${response.status}`)
    },
    dispose,
  }
}
