import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

const localOf = (staging: string, path: string): string => {
  const parts = path.split("/")
  if (path.startsWith("/") || parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`artifact path escapes its directory: ${path}`)
  }
  return join(staging, ...parts)
}

export const writeArtifactDir = (
  dir: string, files: readonly { readonly path: string; readonly bytes: Uint8Array }[],
): void => {
  const staging = `${dir}.staging`
  rmSync(staging, { recursive: true, force: true })
  for (const file of files) {
    const target = localOf(staging, file.path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, file.bytes)
  }
  rmSync(dir, { recursive: true, force: true })
  renameSync(staging, dir)
}
