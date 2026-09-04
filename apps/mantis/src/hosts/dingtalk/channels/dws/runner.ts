/**
 * channels/dws/runner.ts - the dws CLI RUNNER seam.
 *
 * Concept: dws acts as the logged-in USER. The runner is injectable so tests
 * never invoke the real CLI; dwsBunRunner executes the installed dws binary
 * with JSON output and throws on non-zero exits.
 */
export interface DwsRunner {
  readonly run: (args: ReadonlyArray<string>) => Promise<string>
}

/** real runner: executes the dws CLI (installed at ~/.bun/bin/dws) */
export const dwsBunRunner: DwsRunner = {
  run: async (args) => {
    const out = Bun.spawnSync(["dws", "--format", "json", ...args], { stdout: "pipe", stderr: "pipe" })
    if (out.exitCode !== 0)
      throw new Error("dws " + args.join(" ") + " failed (" + out.exitCode + "): " + out.stderr.toString())
    return out.stdout.toString()
  }
}
