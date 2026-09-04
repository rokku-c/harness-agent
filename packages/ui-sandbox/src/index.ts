import type { ExtensionManifest, Json } from "@effect-agent/ui-protocol"

export interface SandboxRequest { readonly code: string; readonly input?: Record<string, Json>; readonly extension: ExtensionManifest; readonly dependencies?: ReadonlyArray<string>; readonly capabilities?: ReadonlyArray<string> }
export interface SandboxResult { readonly ok: boolean; readonly value?: unknown; readonly error?: string }
export interface UISandbox { execute(request: SandboxRequest): Promise<SandboxResult> }

const allowed = new Set(["read:data", "render", "emit:event", "execute:script"])
export const denySandbox: UISandbox = {
  execute: async ({ extension }) => ({ ok: false, error: "no sandbox runtime configured for " + extension.name })
}

export const validateSandboxRequest = (request: SandboxRequest): SandboxResult | undefined => {
  if (request.code.length > 50_000) return { ok: false, error: "script exceeds 50000 characters" }
  if (!request.extension.permissions.every((permission) => allowed.has(permission))) return { ok: false, error: "extension requests unknown permission" }
  if (!request.extension.permissions.includes("execute:script")) return { ok: false, error: "extension lacks execute:script permission" }
  const dependencies = request.dependencies ?? []
  if (new Set(dependencies).size !== dependencies.length || dependencies.some((name) => !/^[\w.-]+$/.test(name))) return { ok: false, error: "invalid dependency declaration" }
  for (const capability of request.capabilities ?? []) if (!request.extension.permissions.includes(capability as never)) return { ok: false, error: "capability lacks permission: " + capability }
  return undefined
}

export const guardedSandbox = (sandbox: UISandbox): UISandbox => ({
  execute: async (request) => {
    const failure = validateSandboxRequest(request)
    if (failure !== undefined) return failure
    return sandbox.execute(request)
  }
})
