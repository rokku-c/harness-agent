/**
 * The declaration of the host's control plane: the five `/-/planes` operations,
 * their methods, path templates and schemas — the single source of the control
 * paths. `operation-match.ts` compiles those paths into matchers and
 * `operation-run.ts` executes a match; the node operation table (effect-apps)
 * reads this array to place the host's operations next to the apps they govern.
 */
import type { HostOperation } from "./operations.ts"

const idParam = { type: "string", description: "target plugin id" } as const

const byId = {
  type: "object",
  properties: { id: idParam },
  required: ["id"],
  additionalProperties: false,
} as const

const enabledResult = {
  type: "object",
  properties: { ok: { type: "boolean" }, id: { type: "string" }, enabled: { type: "boolean" } },
  required: ["ok", "id", "enabled"],
} as const

export const HOST_OPERATIONS: readonly HostOperation[] = [
  {
    name: "list",
    plane: "lifecycle",
    method: "GET",
    path: "/-/planes",
    description: "List every registered plugin with its enabled flag and dispatch priority.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, enabled: { type: "boolean" }, priority: { type: "number" } },
        required: ["id", "enabled", "priority"],
      },
    },
  },
  {
    name: "enable",
    plane: "lifecycle",
    method: "POST",
    path: "/-/planes/:id/enable",
    description: "Load a registered plugin. ok is false when the id is unknown, already enabled, or its load() failed.",
    inputSchema: byId,
    outputSchema: enabledResult,
  },
  {
    name: "disable",
    plane: "lifecycle",
    method: "POST",
    path: "/-/planes/:id/disable",
    description: "Unload a plugin but keep it registered. ok is false when the id is unknown or already disabled.",
    inputSchema: byId,
    outputSchema: enabledResult,
  },
  {
    name: "reload",
    plane: "lifecycle",
    method: "POST",
    path: "/-/planes/:id/reload",
    description: "Re-read one app's code from source and serve it in place, without restarting the host. "
      + "ok is false when the id is unknown, was never loaded, or the incoming generation was refused or failed to load — "
      + "and in every one of those cases the generation already serving keeps serving.",
    inputSchema: byId,
    outputSchema: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
        id: { type: "string" },
        generation: { type: "number", description: "the generation now serving; 0 is what boot loaded" },
        reason: { type: "string" },
        detail: { type: "string" },
        report: { type: "object" },
      },
      required: ["ok", "id"],
    },
  },
  {
    name: "unregister",
    plane: "lifecycle",
    method: "DELETE",
    path: "/-/planes/:id",
    description: "Unload a plugin and drop it from the registry. ok is false when the id is unknown.",
    inputSchema: byId,
    outputSchema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
  },
]
