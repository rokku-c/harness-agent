/**
 * The formal proofs, as a check.
 *
 * `formal/` is the Lean model of the mechanisms the product rests on, with the
 * invariants each one owes stated as theorems: a navigation chain that neither
 * invents a screen nor hangs, an id derivation that cannot mint a duplicate,
 * config layering whose provenance names the layer the value came from, and so
 * on — one module per mechanism, each naming the file it models at the top. A
 * proof nothing runs is a comment, so — like every other invariant here — it
 * gets a check.
 *
 * Usage:
 *   bun scripts/check-proofs.ts
 *
 * Lean is looked for on PATH, then where elan installs it. Exit 0 = the model
 * builds; exit 1 = a theorem no longer holds, or no Lean to check with.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const findLake = (): string | undefined => {
  const onPath = Bun.which("lake")
  if (onPath !== null) return onPath
  const elan = join(homedir(), ".elan", "bin", "lake")
  return existsSync(elan) ? elan : undefined
}

/** What the model claims, so the summary says something. */
const claims = (dir: string): { files: number; theorems: number } => {
  const sources = readdirSync(dir).filter((name) => name.endsWith(".lean"))
  const proofs = sources.map((name) => readFileSync(join(dir, name), "utf-8"))
  return {
    files: sources.length,
    theorems: proofs.reduce((total, text) => total + (text.match(/^theorem /gm) ?? []).length, 0),
  }
}

/**
 * The modules `formal/Formal.lean` does not import.
 *
 * `lake build` compiles that root module's import closure and nothing else — a
 * module sitting in the directory but absent from the list is never compiled. So
 * `claims` above would count theorems out of a file no build ever reached, and a
 * proof that had stopped holding would be reported as one that holds. This is
 * checked rather than assumed because adding the file is the step that gets
 * forgotten, and nothing else about the build says so.
 */
const unimported = (dir: string): readonly string[] => {
  const root = readFileSync(join(dir, "..", "Formal.lean"), "utf-8")
  const imported = new Set([...root.matchAll(/^import Formal\.(\S+)/gm)].map((match) => match[1]))
  return readdirSync(dir)
    .filter((name) => name.endsWith(".lean"))
    .map((name) => name.replace(/\.lean$/, ""))
    .filter((module) => !imported.has(module))
}

const main = (): number => {
  const lake = findLake()
  if (lake === undefined) {
    console.log("check-proofs: no Lean toolchain — looked on PATH and in ~/.elan/bin")
    console.log("install: curl -sSf https://elan.lean-lang.org/elan-init.sh | sh")
    return 1
  }
  const model = join(import.meta.dir, "..", "formal", "Formal")
  const missing = unimported(model)
  if (missing.length > 0) {
    console.log(`check-proofs: ${missing.join(", ")} is in formal/Formal/ but not imported by`
      + " formal/Formal.lean — the build never compiles it")
    return 1
  }
  const built = Bun.spawnSync({ cmd: [lake, "build"], cwd: join(model, ".."), stdout: "pipe", stderr: "pipe" })
  const output = `${built.stdout.toString()}${built.stderr.toString()}`.trim()
  if (built.exitCode !== 0) {
    console.log(output)
    console.log("check-proofs: formal/ does not build")
    return 1
  }
  const { files, theorems } = claims(model)
  const warnings = output.split("\n").filter((line) => line.startsWith("warning")).length
  console.log(`check-proofs: clean (${theorems} theorems in ${files} files, ${warnings} warnings)`)
  return 0
}

process.exit(main())
