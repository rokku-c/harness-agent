import { spawnSync } from "node:child_process"
import { BUNDLE_EXTERNALS } from "./externals.ts"

export interface BuildEntryOptions {
  readonly entry: string
  readonly outfile: string
  readonly target: "bun" | "browser"
  readonly what: string
}

export const buildEntry = (options: BuildEntryOptions): void => {
  const run = spawnSync(
    process.execPath,
    [
      "build", options.entry, "--outfile", options.outfile,
      "--target", options.target,
      ...BUNDLE_EXTERNALS.flatMap((name) => ["--external", name]),
      "--minify",
    ],
    { encoding: "utf8" },
  )
  if (run.status !== 0) throw new Error(options.what + " build failed: " + (run.stderr || run.stdout))
}
