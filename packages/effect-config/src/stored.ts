import { isDeepStrictEqual } from "node:util"
import type { ConfigDeclaration, ConfigOutcome } from "./contract.ts"
import { rebuildRequired } from "./errors.ts"
import type { StoredConfig } from "./store.ts"
import { failure, validateConfig } from "./validation.ts"

export function validateStored(decl: ConfigDeclaration, record: StoredConfig): ConfigOutcome {
  const outcome = validateConfig(decl, structuredClone(record.value), record.sources)
  if (!record.initialized || !Number.isSafeInteger(record.revision) || record.revision < 1 ||
    !outcome.ok || !isDeepStrictEqual(record.value, outcome.value) ||
    !isDeepStrictEqual(record.sources, outcome.sources)) {
    const stale = rebuildRequired("stored config")
    return failure(decl.appId, stale.message, stale.reason)
  }
  return { ok: true, appId: decl.appId, value: record.value, sources: record.sources, revision: record.revision }
}
