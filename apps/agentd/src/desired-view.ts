import type { DesiredAgentConfig } from "@effect-agent/agentd"

/**
 * The desired state as a *read* surface hands it over: what an agent is given to
 * run, with the one field that is a secret stated rather than shown (§F10).
 *
 * The center is the only holder of the plaintext, and the surface that *writes*
 * it — the config form that declares it — is where it is read back. A read
 * surface is a different audience: `agentd_status` and `agentd_desired` are
 * `access: "read"`, which an agent may hold a grant on, so a fleet listing that
 * carried the value would hand every agent's credential to whoever can read the
 * list. What an operator needs from this side is whether one is held — the same
 * answer `nodeLiveness().tokenRequired` gives about the fleet's shared secret
 * instead of that secret.
 *
 * Stated, not stripped: a reader comparing two agents is told which of them the
 * door will refuse, and no field of the answer is silently missing.
 */
export const shownToReader = (desired: DesiredAgentConfig): Record<string, unknown> => {
  const { credential: held, ...rest } = desired
  return { ...rest, credentialHeld: held !== undefined }
}
