/**
 * The end of one transcript on a machine we reach over ssh.
 *
 * A second call rather than a field in the index: an index of several hundred
 * sessions costs one round trip, and the three tails a caller actually wants
 * cost three small ones. That is what keeps a collection bounded by need rather
 * than by how much work has accumulated on the machine.
 */
import type { RemoteTransport } from "../remote/types.ts"
import { TAIL_BYTES } from "./tails.ts"

/** A tail can carry arbitrary bytes, so it comes back base64: a transcript with
 *  a heredoc or a NUL in it must not be able to mangle the ssh session. */
export const TAILER = `set -u
[ -f "$1" ] || exit 1
tail -c "\${2:-4096}" "$1" 2>/dev/null | base64 | tr -d '\\n'
`

/** `sh -s` reads the script from stdin, so the path is an argument, not source. */
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
