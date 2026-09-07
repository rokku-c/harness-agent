import type { UICommand } from "@effect-agent/ui-protocol"
import type { UIRuntime } from "./runtime.ts"
import { makeUIRuntime } from "./runtime.ts"
import type { DefinitionStore } from "@effect-agent/ui-definition"
import { makeSQLiteLog } from "./sqlite-log.ts"

export interface UIJournal {
  readonly append: (command: UICommand) => Promise<void>
  readonly read: () => Promise<ReadonlyArray<UICommand>>
  readonly replay: (runtime: UIRuntime) => Promise<number>
  readonly flush: () => Promise<void>
}

export const makeUIJournal = (file: string): UIJournal => {
  const log = makeSQLiteLog<UICommand>(file, "ui.command")
  return { append: log.append, read: log.read, flush: async () => {}, replay: async (runtime) => {
    const commands = await log.read()
    for (const command of commands) runtime.apply(command)
    return commands.length
  } }
}

export const restoreUIRuntime = async (store: DefinitionStore, initialCanvas: string, file: string): Promise<UIRuntime> => {
  const journal = makeUIJournal(file)
  let replaying = true
  const runtime = makeUIRuntime(store, initialCanvas, { onCommand: (command) => { if (!replaying) void journal.append(command) } })
  await journal.replay(runtime)
  replaying = false
  return runtime
}
