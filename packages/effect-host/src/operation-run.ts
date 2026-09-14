import type { HostOperation, HostOperationTarget } from "./operations.ts"
import { messageOf } from "@effect-agent/effect-interface"

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
        ...(error === undefined ? {} : { detail: messageOf(error) }),
        ...(report === undefined ? {} : { report }),
      }
    }
    case "unregister":
      return { ok: await target.unregister(id) }
  }
}
