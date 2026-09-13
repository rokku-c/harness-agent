/**
 * The configuration store the platform boots from, named once.
 *
 * The boot path and the rebuild command both tell an operator about this file,
 * so they must not each carry their own literal: two copies is how the file an
 * operator is told to repair becomes a different file from the one that refused.
 * Relative paths resolve against the working directory, which for `bun run up`
 * and `bun run config:rebuild` alike is the repository root.
 */
export const CONFIG_FILE_ENV = "EFFECT_CONFIG_FILE"
export const DEFAULT_CONFIG_FILE = ".effect-agent/config-v2.sqlite"
export const configFileFrom = (explicit?: string): string =>
  explicit ?? process.env[CONFIG_FILE_ENV] ?? DEFAULT_CONFIG_FILE
