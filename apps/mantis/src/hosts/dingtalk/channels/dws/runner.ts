export interface DwsRunner {
  readonly run: (args: ReadonlyArray<string>) => Promise<string>
}

export const dwsBunRunner: DwsRunner = {
  run: async (args) => {
    const out = Bun.spawnSync(["dws", "--format", "json", ...args], { stdout: "pipe", stderr: "pipe" })
    if (out.exitCode !== 0)
      throw new Error("dws " + args.join(" ") + " failed (" + out.exitCode + "): " + out.stderr.toString())
    return out.stdout.toString()
  }
}
