export type ConfigFailureReason = "rebuild-required"

export class ConfigError extends Error {
  constructor(message: string, readonly reason?: ConfigFailureReason) { super(message) }
}

export const rebuildRequired = (subject: string): ConfigError =>
  new ConfigError(`${subject} does not match the current schema; operator must rebuild the config store`, "rebuild-required")
