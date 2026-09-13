/**
 * Ambient system-access scanning: does the code reach fs/network/process itself?
 *
 * One implementation, two questions. The boundary checker asks "is this app
 * allowed to reach the system directly?" and honours the grandfathering lists in
 * effect.boundary.json. The inventory asks "could this app run somewhere other
 * than the OS host?" and deliberately ignores those lists, because a
 * grandfathered exemption still means the app cannot leave the OS.
 */

/** Ambient system access an app is not supposed to reach for directly. */
export const SYSTEM_IO: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /Bun\.(serve|spawn|spawnSync|file|write|read|writeSync)\s*\(/g, label: "Bun.serve/spawn/file" },
  { re: /(?:^|[^\w.$])fetch\s*\(/g, label: "network fetch" },
  { re: /(?:^|[^\w.$])(?:WebSocket|connect)\s*\(/g, label: "socket/connect" },
  { re: /process\.(env|cwd|platform|arch|argv|exit)\b/g, label: "process/env" },
]

/** Line-comment-only stripping — enough to avoid flagging prose in headers. */
export const stripComments = (source: string): string =>
  source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n")

export interface SystemIoHit {
  readonly label: string
  readonly match: string
}

/** First ambient-IO hit in the source, or undefined. */
export const scanSystemIo = (source: string): SystemIoHit | undefined => {
  const code = stripComments(source)
  for (const { re, label } of SYSTEM_IO) {
    re.lastIndex = 0
    const m = re.exec(code)
    if (m !== null) return { label, match: m[0].trim() }
  }
  return undefined
}
