export const SYSTEM_IO: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /Bun\.(serve|spawn|spawnSync|file|write|read|writeSync)\s*\(/g, label: "Bun.serve/spawn/file" },
  { re: /(?:^|[^\w.$])fetch\s*\(/g, label: "network fetch" },
  { re: /(?:^|[^\w.$])(?:WebSocket|connect)\s*\(/g, label: "socket/connect" },
  { re: /process\.(env|cwd|platform|arch|argv|exit)\b/g, label: "process/env" },
]

export const stripComments = (source: string): string =>
  source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n")

export interface SystemIoHit {
  readonly label: string
  readonly match: string
}

export const scanSystemIo = (source: string): SystemIoHit | undefined => {
  const code = stripComments(source)
  for (const { re, label } of SYSTEM_IO) {
    re.lastIndex = 0
    const m = re.exec(code)
    if (m !== null) return { label, match: m[0].trim() }
  }
  return undefined
}
