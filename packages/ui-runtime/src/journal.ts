import { appendFile, mkdir, readFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { UICommand } from "@effect-agent/ui-protocol"
import type { UIRuntime } from "./runtime.ts"
import { makeUIRuntime } from "./runtime.ts"
import type { DefinitionStore } from "@effect-agent/ui-definition"

export interface UIJournal {
  readonly append: (command: UICommand) => Promise<void>
  readonly read: () => Promise<ReadonlyArray<UICommand>>
  readonly replay: (runtime: UIRuntime) => Promise<number>
}

const decode = (line: string): UICommand | undefined => {
  try {
    const value = JSON.parse(line) as UICommand
    return typeof value?.kind === "string" ? value : undefined
  } catch { return undefined }
}

export const makeUIJournal = (file: string): UIJournal => {
  const read = async (): Promise<ReadonlyArray<UICommand>> => {
    try {
      const text = await readFile(file, "utf8")
      return text.split("\n").map(decode).filter((item): item is UICommand => item !== undefined)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
      throw error
    }
  }
  const append = async (command: UICommand): Promise<void> => {
    await mkdir(dirname(file), { recursive: true })
    await appendFile(file, JSON.stringify(command) + "\n", "utf8")
  }
  return { append, read, replay: async (runtime) => {
    const commands = await read()
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
