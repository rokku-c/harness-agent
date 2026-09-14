import type { DesiredAgentConfig } from "@effect-agent/agentd"

export const shownToReader = (desired: DesiredAgentConfig): Record<string, unknown> => {
  const { credential: held, ...rest } = desired
  return { ...rest, credentialHeld: held !== undefined }
}
