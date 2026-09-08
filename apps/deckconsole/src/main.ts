import { startDeckServer } from "./standalone.ts"
import { parseLaunchers } from "./domain/launchers.ts"

if (import.meta.main) {
  const app = startDeckServer({
    host: process.env.DECK_HOST, port: Number(process.env.DECK_PORT ?? 4851),
    configFile: process.env.DECK_FILE,
    launchers: process.env.DECK_AGENTS === undefined ? [] : parseLaunchers(JSON.parse(process.env.DECK_AGENTS)),
  })
  console.log("deckconsole listening on " + app.base)
  const close = async () => { await app.close(); process.exit(0) }
  process.once("SIGINT", close)
  process.once("SIGTERM", close)
}
