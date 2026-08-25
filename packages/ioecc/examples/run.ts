import { basename, resolve } from "node:path"
import { pathToFileURL } from "node:url"

/** IOECC examples 一键运行器：bun run example <name> */
const directory = resolve(import.meta.dir)
const files = [...new Bun.Glob("[0-9][0-9]-*.ts").scanSync(directory)].sort()
const query = Bun.argv[2]

const keyOf = (file: string) => basename(file, ".ts").replace(/^\d+-/, "")

if (!query) {
  console.log("Available examples:\n")
  for (const file of files) console.log(`  ${keyOf(file).padEnd(14)} ${file}`)
  console.log("\nRun with: bun run example <name>")
  process.exit(0)
}

const matches = files.filter((file) => {
  const full = basename(file, ".ts")
  return query === file || query === full || query === keyOf(file)
})

if (matches.length !== 1) {
  const reason = matches.length === 0 ? "Unknown" : "Ambiguous"
  console.error(`${reason} example: ${query}`)
  console.error(`Available: ${files.map(keyOf).join(", ")}`)
  process.exit(1)
}

await import(pathToFileURL(resolve(directory, matches[0])).href)
