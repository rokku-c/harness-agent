/**
 * mantis dingtalk-host live entry: a REAL model over a REAL dingtalk
 * channel (robot or dws), configured from config.toml + MANTIS_* env.
 * Assembly is split by concept into ./main/: setup.ts (config/log/model),
 * card.ts (interactive approval card deliverer), channel.ts (channel
 * selection), approval.ts (protected-tool policy). Run:
 *   bun apps/mantis/src/hosts/dingtalk/main.ts
 */
import { envVar } from "../../env.ts"
import { NotesStore } from "../../tools.ts"
import { MantisHost } from "./host.ts"
import { setupRuntime } from "./main/setup.ts"
import { makeCardDeliverer } from "./main/card.ts"
import { makeChannel, type CardActionHandler } from "./main/channel.ts"
import { makeApproval } from "./main/approval.ts"

const { config, logger, model, logFile } = setupRuntime()

// the host is created after the channel (the channel forwards card-button
// clicks to it); a let forward-reference keeps the wiring in one place
let host: MantisHost | undefined

const cardDeliverer = makeCardDeliverer(config)
const onCard: CardActionHandler = (action) => {
  if (host !== undefined) return host.handleCardAction(action)
  return undefined
}
const channel = makeChannel(config, onCard)
const approval = makeApproval(config, cardDeliverer, logger)

const workspaceFile = envVar("WORKSPACE_FILE")
const memoryDir = envVar("MEMORY_DIR")
host = new MantisHost({
  workspace: workspaceFile === undefined || workspaceFile === "" ? undefined : new NotesStore({ file: workspaceFile }),
  memoryDir: memoryDir === undefined || memoryDir === "" ? undefined : memoryDir,
  model,
  maxSteps: config.model.maxSteps,
  maxReflections: config.model.maxReflections,
  approval,
  logger
})
logger.info("mantis live on " + config.channel + " channel", { model: config.model.model, logFile: logFile ?? undefined })
if (approval !== undefined)
  logger.info("protected tools (owner approval cards on): " + config.approvals.protectedTools.join(", "))
await host.run(channel)
