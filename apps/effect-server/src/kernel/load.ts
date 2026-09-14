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

export const planeStandIn = (spec: KernelPlaneSpec, point: DispatchPoint<KernelInstance>): EffectPlugin => {
  const planeOf = (kernel: KernelInstance): LoadedPlane | undefined => kernel.planes.get(spec.id)
  return {
    id: spec.id,
    priority: spec.priority,
    ...(spec.routes === undefined ? {} : { routes: spec.routes }),
    load: async () => {
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
