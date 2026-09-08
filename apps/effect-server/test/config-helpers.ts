import { afterEach } from "bun:test"
import { makeConfigRegistry, makeSqliteConfigStore } from "@effect-agent/effect-config"

const close: Array<() => void> = []
afterEach(() => { for (const stop of close.splice(0).reverse()) stop() })
export const memoryConfigs = () => {
  const store = makeSqliteConfigStore({ file: ":memory:" })
  const registry = makeConfigRegistry({ store })
  close.push(() => { registry.close(); store.close() })
  return registry
}
