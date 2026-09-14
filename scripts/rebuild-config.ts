import { makeSqliteConfigStore, type ConfigStore } from "@effect-agent/effect-config"
import { configFileFrom } from "../apps/effect-server/src/config-runtime/config-file.ts"

const usage = (file: string): string => `usage: bun run config:rebuild <appId...>

Drops the stored configuration of the named apps so the next start re-seeds it
from the current schema and effect.yaml. Other apps' records are untouched.
Store: ${file} (override with EFFECT_CONFIG_FILE)`

const held = (store: ConfigStore, appId: string): boolean => {
  try { return store.read(appId) !== undefined }
  catch { return true }
}

const main = (args: readonly string[]): number => {
  const file = configFileFrom()
  const ids = args.filter((arg) => !arg.startsWith("-"))
  if (ids.length === 0) {
    console.error(usage(file))
    return args.includes("--help") || args.includes("-h") ? 0 : 1
  }
  const store = makeSqliteConfigStore({ file })
  try {
    for (const appId of ids) {
      const present = held(store, appId)
      store.remove(appId)
      console.log(`${appId}: ${present ? "record dropped" : "no record"}`)
    }
    console.log(`store: ${file} — the next start re-seeds the records above`)
    return 0
  } finally { store.close() }
}

process.exit(main(process.argv.slice(2)))
