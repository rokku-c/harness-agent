#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs"
import { parse } from "yaml"
import { startStandaloneApp, startStandaloneStdio } from "@effect-agent/effect-standalone"
import { hostableApps, loadApp } from "./lib/app-manifest.ts"

const usage = (): string => `usage: bun run app:host <appId> [--port <n>] [--app-routes] [--stdio] [--config <json|@file>]
  --config merges over the app's effect.yaml config: layer, key by key (the config registry's own
  override layer); it does not replace that layer. Without it the app runs the yaml layer verbatim —
  for a file-backed app that is the real file (board writes .effect-agent/board.sqlite).
  hostable: ${hostableApps().join(", ")}`

const readOverride = (spec: string): unknown => {
  if (!spec.startsWith("@")) return parse(spec)
  const file = spec.slice(1)
  if (!existsSync(file)) throw new Error(`invalid --config: no such file: ${file}`)
  return parse(readFileSync(file, "utf8"))
}

interface Flags {
  readonly id: string; readonly port: number; readonly appRoutes: boolean; readonly stdio: boolean
  readonly override?: unknown
}

const parseFlags = (argv: readonly string[]): Flags => {
  const id = argv.find((a) => !a.startsWith("--"))
  if (id === undefined) throw new Error(usage())
  const portAt = argv.indexOf("--port"), raw = portAt < 0 ? "0" : argv[portAt + 1]
  if (!/^\d+$/.test(raw ?? "")) throw new Error(`invalid --port: ${raw ?? ""}`)
  const configAt = argv.indexOf("--config"), spec = argv[configAt + 1]
  if (configAt >= 0 && (spec === undefined || spec === "")) throw new Error("invalid --config: expected <json|@file>")
  const override = configAt < 0 ? undefined : readOverride(spec as string)
  return {
    id, port: Number(raw), stdio: argv.includes("--stdio"), appRoutes: argv.includes("--app-routes"),
    ...(override === undefined ? {} : { override }),
  }
}

const provenance = (config: { readonly sources: Readonly<Record<string, string>> }): string => {
  const entries = Object.entries(config.sources).map(([key, from]) => `${key} from ${from}`)
  return entries.length === 0 ? "nothing declared" : entries.join(", ")
}

const main = async (argv: readonly string[]): Promise<void> => {
  if (argv.includes("--help") || argv.includes("-h")) return void console.error(usage())
  const flags = parseFlags(argv)
  const { app, config } = await loadApp(flags.id)
  const layers = { ...(config === undefined ? {} : { config }), ...(flags.override === undefined ? {} : { override: flags.override }) }
  const hosted = flags.stdio
    ? await startStandaloneStdio({ app, ...layers })
    : await startStandaloneApp({ app, ...layers, port: flags.port, appRoutes: flags.appRoutes })
  console.error(`${hosted.app}: requires ${hosted.requires.length === 0 ? "nothing" : hosted.requires.join(", ")}`)
  console.error(`${hosted.app}: surface ${hosted.surface.join(" ")}`)
  console.error(`${hosted.app}: config ${provenance(hosted.config)}`)
  if ("mcpUrl" in hosted) console.error(`${hosted.app}: MCP at ${hosted.mcpUrl}\n${hosted.app}: not open: app routes${flags.appRoutes ? "" : " (pass --app-routes)"}, console, config, control planes`)
  const done = new Promise<void>((resolve) => {
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => resolve())
  })
  await done
  await hosted.stop()
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((error: Error) => {
    console.error(`app:host failed: ${error.message}`)
    process.exit(1)
  })
}
