import { makeConfigRegistry, makeSqliteConfigStore, type SqliteConfigStoreOptions } from "@effect-agent/effect-config"
import { effectConfig } from "./effect-config.ts"

export const openGatewayConfig = (options: SqliteConfigStoreOptions = {}) => {
  const store = makeSqliteConfigStore(options)
  const configs = makeConfigRegistry({ store })
  configs.register(effectConfig)
  const close = () => { configs.close(); store.close() }
  try {
    const initialized = configs.initialize(effectConfig.appId)
    if (!initialized.ok) throw new Error(initialized.error ?? "ai-gateway: configuration initialization failed")
  } catch (cause) { close(); throw cause }
  return {
    getConfig: (): unknown => {
      const outcome = configs.read(effectConfig.appId)
      if (!outcome.ok) throw new Error(outcome.error ?? "ai-gateway: configuration read failed")
      return outcome.value
    },
    close,
  }
}
