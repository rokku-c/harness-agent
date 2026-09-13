/**
 * Loading a kernel revision, and standing in for one (docs/architecture-rework.md
 * §6.2, §6.3-①).
 *
 * Two halves that only make sense together:
 *
 * `loadKernel` turns a revision into a kernel instance. A revision with a `dir` is
 * an artifact: its entry module is imported and asked for `createKernel`. A
 * revision without one is this build's kernel. Same contract either way — which is
 * what lets the bootstrap-ABI gate finally fire on a real mismatch instead of
 * comparing two constants from one build.
 *
 * `planeStandIn` is the flip. The host registers one stable entry per plane slot,
 * once, and never again: ids, priorities and the routing table do not move across
 * a swap. What moves is the one pointer inside the stand-in — `point.activate(B)`
 * — and every request that entered before it finishes on A because the dispatch
 * point captured A at entry (§6.5-5).
 */

import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { EffectPlugin, LoadedPlane } from "@effect-agent/effect-host"
import type { DispatchPoint } from "@effect-agent/effect-host"
import { KERNEL_ENTRY, type KernelRevision } from "@effect-agent/effect-bundle"
import { createKernel, type KernelContext, type KernelFactory, type KernelInstance, type KernelPlaneSpec } from "./index.ts"

export { KERNEL_ENTRY }

export const loadKernel = async (
  revision: KernelRevision, context: KernelContext,
): Promise<KernelInstance> => {
  if (revision.dir === undefined) return createKernel(context)

  const entry = join(revision.dir, KERNEL_ENTRY)
  const module = await import(pathToFileURL(entry).href) as { createKernel?: KernelFactory }
  if (typeof module.createKernel !== "function") {
    throw new Error(`effect-server: kernel artifact ${entry} does not export createKernel`)
  }
  return module.createKernel({ ...context, revision })
}

/**
 * A stable host entry for one plane slot. Registered once at boot; the
 * implementation behind it is whatever kernel is active at request time.
 */
export const planeStandIn = (spec: KernelPlaneSpec, point: DispatchPoint<KernelInstance>): EffectPlugin => {
  const planeOf = (kernel: KernelInstance): LoadedPlane | undefined => kernel.planes.get(spec.id)
  return {
    id: spec.id,
    priority: spec.priority,
    ...(spec.routes === undefined ? {} : { routes: spec.routes }),
    load: async () => {
      // Registering happens before any kernel exists; the slot fills when boot
      // activates one. Re-loading after a control-plane disable rebuilds the plane.
      await point.current()?.start(spec.id)
      return {
        canHandle: (path: string) => point.current()?.planes.get(spec.id)?.canHandle?.(path) ?? false,
        handle: (request: Request) => point.run(async (kernel) => {
          const plane = planeOf(kernel)
          if (plane === undefined) {
            return Response.json({ ok: false, detail: `kernel ${kernel.id} has no plane ${spec.id}` }, { status: 503 })
          }
          return plane.handle(request)
        }),
        stop: async () => { await point.current()?.stop(spec.id) },
      }
    },
  }
}
