/**
 * One `bun build`, for both artifact compilers.
 *
 * The app compiler and the kernel compiler build the same way: the same
 * externals (the host provides the ABI and zod), the same minify, the same
 * "stderr, or stdout if it said nothing there" failure. Each had written the
 * invocation out for itself, so the two artifact formats could drift apart one
 * flag at a time — and a kernel that is subtly unlike an app is discovered on a
 * target machine during a swap, not here.
 */
import { spawnSync } from "node:child_process"
import { BUNDLE_EXTERNALS } from "./externals.ts"

export interface BuildEntryOptions {
  readonly entry: string
  readonly outfile: string
  readonly target: "bun" | "browser"
  /** What is being built, named in the failure: "kernel", "bundle for runtime \"os\"". */
  readonly what: string
}

/** Throws with the compiler's own output when the build fails. */
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
