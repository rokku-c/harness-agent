/** Why a configuration operation was refused, when there is something to do about it. */
export type ConfigFailureReason = "rebuild-required"

/** Only package-owned diagnostics may cross the registry's error boundary. */
export class ConfigError extends Error {
  constructor(message: string, readonly reason?: ConfigFailureReason) { super(message) }
}

/**
 * A refusal is not the same as an explanation. "Operator must rebuild the config
 * store" is only an instruction if the caller can act on it, so the refusal is
 * *typed*: a caller that knows the store file and the rebuild command can name
 * both, and one that does not stays silent instead of guessing from prose.
 */
export const rebuildRequired = (subject: string): ConfigError =>
  new ConfigError(`${subject} does not match the current schema; operator must rebuild the config store`, "rebuild-required")
