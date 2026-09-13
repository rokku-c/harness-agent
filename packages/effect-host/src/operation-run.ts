/**
 * Executing one declared host operation against a target.
 *
 * IO lives in the lifecycle, not here: the target answers and this shapes the
 * answer into the operation's declared output — including folding a reload's
 * error (and its absence) into the result object, so "refused, still serving"
 * is a payload rather than a thrown failure.
 */
import type { HostOperation, HostOperationTarget } from "./operations.ts"
import { errorDetail } from "./response.ts"

/** Execute one declared operation. IO lives in the lifecycle, not here. */
export const runHostOperation = async (
  operation: HostOperation,
  params: Readonly<Record<string, string>>,
  target: HostOperationTarget,
): Promise<unknown> => {
  const id = params.id
  switch (operation.name) {
    case "list":
      return target.list()
    case "enable":
    case "disable": {
      const ok = operation.name === "enable" ? await target.enable(id) : await target.disable(id)
      return { ok, id, enabled: target.isEnabled(id) }
    }
    case "reload": {
      if (target.reload === undefined) return { ok: false, id, detail: "this host does not own app sources" }
      const { ok, reason, generation, error, report } = await target.reload(id)
      return {
        ok, id,
        ...(reason === undefined ? {} : { reason }),
        ...(generation === undefined ? {} : { generation }),
        ...(error === undefined ? {} : { detail: errorDetail(error) }),
        ...(report === undefined ? {} : { report }),
      }
    }
    case "unregister":
      return { ok: await target.unregister(id) }
  }
}
