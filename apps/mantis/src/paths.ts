import { join } from "node:path"
import { envVar } from "./env.ts"

const dataDir = (): string => envVar("UI_DIR") ?? join(import.meta.dir, "../.ui")

export const workspaceFile = (dir: string = dataDir()): string => join(dir, "workspace.sqlite")
