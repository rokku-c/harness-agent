/** Only package-owned diagnostics may cross the registry's error boundary. */
export class ConfigError extends Error {}

export const rebuildRequired = (subject: string): ConfigError =>
  new ConfigError(`${subject} does not match the current schema; operator must rebuild the config store`)
