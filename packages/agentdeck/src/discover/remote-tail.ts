import type { RemoteTransport } from "../remote/types.ts"
import { TAIL_BYTES } from "./tails.ts"

export const TAILER = `set -u
[ -f "$1" ] || exit 1
tail -c "\${2:-4096}" "$1" 2>/dev/null | base64 | tr -d '\\n'
`

const quote = (value: string): string => `'${value.split("'").join(`'\\''`)}'`

export const remoteTail = async (
  transport: RemoteTransport,
  path: string,
  bytes = TAIL_BYTES
): Promise<string | undefined> => {
  const run = await transport.run(`sh -s ${quote(path)} ${bytes}`, { stdin: TAILER, timeoutMs: 10_000 })
  if (run.timedOut || run.code !== 0) return undefined
  const text = run.stdout.trim()
  return text.length === 0 ? undefined : Buffer.from(text, "base64").toString("utf-8")
}
