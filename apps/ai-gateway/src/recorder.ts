import { appendFile, mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import type { GatewayEvent, GatewayRecorder } from "@effect-agent/ai-gateway"

export const jsonlRecorder = (file: string): GatewayRecorder => {
  let pending = Promise.resolve()
  return {
    record: async (event: GatewayEvent) => {
      pending = pending.then(async () => {
        await mkdir(dirname(file), { recursive: true })
        await appendFile(file, JSON.stringify(event) + "\n")
      })
      await pending
    }
  }
}
