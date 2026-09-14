export const CONFIG_FILE_ENV = "EFFECT_CONFIG_FILE"
export const DEFAULT_CONFIG_FILE = ".effect-agent/config-v2.sqlite"
export const configFileFrom = (explicit?: string): string =>
  explicit ?? process.env[CONFIG_FILE_ENV] ?? DEFAULT_CONFIG_FILE
