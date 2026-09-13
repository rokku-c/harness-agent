/**
 * What one app's code actually does, regardless of what its bundle declares.
 *
 * The fact-finding half of the portability inventory: ambient IO and node/bun
 * builtins found by scanning the app's src/, plus the artifact header if one
 * exists. It reads no allowlists — that is the boundary checker's job.
 */

import { existsSync, readFileSync } from "node:fs"
import { join, posix } from "node:path"
import { importSpecifiers, isBuiltinSpecifier } from "./import-scan.ts"
import { sourceFiles, type Pkg } from "./package-graph.ts"
import { scanSystemIo } from "./system-io-scan.ts"
import type { EffectRuntimeKind } from "../../packages/effect-bundle/src/compat.ts"

export interface Hit {
  readonly file: string
  readonly detail: string
}

export interface AppInventory {
  readonly dir: string
  readonly name: string
  readonly abi?: string
  readonly declaredRuntimes?: readonly EffectRuntimeKind[]
  /** what the code can actually do, regardless of what it declares */
  readonly floor: "os" | "unverified"
  readonly ambientIo: readonly Hit[]
  readonly builtins: readonly Hit[]
}

export const inspectApp = (root: string, app: Pkg): AppInventory => {
  const ambientIo: Hit[] = []
  const builtins: Hit[] = []
  for (const file of sourceFiles(root, app.dir + "/src")) {
    const src = readFileSync(file, "utf8")
    const fileRel = posix.relative(root, file.split("\\").join("/"))
    const io = scanSystemIo(src)
    if (io !== undefined) ambientIo.push({ file: fileRel, detail: `${io.label} — \`${io.match}\`` })
    for (const spec of importSpecifiers(src)) {
      if (isBuiltinSpecifier(spec)) builtins.push({ file: fileRel, detail: spec })
    }
  }

  const manifestPath = join(root, app.dir, "effect.bundle.json")
  const manifest = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, "utf8")) as { abi?: string; runtimes?: readonly EffectRuntimeKind[] })
    : undefined

  return {
    dir: app.dir,
    name: app.name,
    abi: manifest?.abi,
    declaredRuntimes: manifest?.runtimes,
    floor: ambientIo.length > 0 || builtins.length > 0 ? "os" : "unverified",
    ambientIo,
    builtins,
  }
}
