import { workspaceFile } from "../../paths.ts"
import { NotesStore } from "../../tools.ts"
import { MantisHost } from "./host.ts"
import { setupRuntime } from "./main/setup.ts"
import { makeCardDeliverer } from "./main/card.ts"
import { makeChannel, type CardActionHandler } from "./main/channel.ts"
import { makeApproval } from "./main/approval.ts"

const { config, logger, model, logFile } = setupRuntime()

let host: MantisHost | undefined

const cardDeliverer = makeCardDeliverer(config)
const onCard: CardActionHandler = (action) => {
  if (host !== undefined) return host.handleCardAction(action)
  return undefined
}
const channel = makeChannel(config, onCard)
const approval = makeApproval(config, cardDeliverer, logger)

host = new MantisHost({
  workspace: new NotesStore({ file: workspaceFile() }),
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
