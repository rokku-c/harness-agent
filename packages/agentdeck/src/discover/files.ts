import { open, readdir, stat } from "node:fs/promises"
import { join } from "node:path"

export interface FoundFile {
  readonly path: string
  readonly size: number
  readonly mtimeMs: number
  readonly birthtimeMs: number
}

export const findFiles = async (
  root: string,
  accept: (name: string) => boolean,
  maxDepth = 4
): Promise<ReadonlyArray<FoundFile>> => {
  const out: FoundFile[] = []
  const walk = async (dir: string, depth: number): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => undefined)
    if (entries === undefined) return
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) { if (depth < maxDepth) await walk(path, depth + 1); continue }
      if (!entry.isFile() || !accept(entry.name)) continue
      const info = await stat(path).catch(() => undefined)
      if (info === undefined) continue
      out.push({ path, size: info.size, mtimeMs: info.mtimeMs, birthtimeMs: info.birthtimeMs })
    }
  }
  await walk(root, 0)
  return out
}

export const readHead = async (path: string, maxBytes: number): Promise<string> => {
  const handle = await open(path, "r")
  try {
    const buffer = Buffer.alloc(maxBytes)
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0)
    return buffer.subarray(0, bytesRead).toString("utf-8")
  } finally { await handle.close() }
}

export const readWhole = async (path: string, maxBytes: number): Promise<string> =>
  await readHead(path, maxBytes).catch(() => "")

export const readTail = async (path: string, maxBytes: number): Promise<string> => {
  const handle = await open(path, "r")
  try {
    const info = await handle.stat()
    const start = Math.max(0, info.size - maxBytes)
    const buffer = Buffer.alloc(Math.min(maxBytes, info.size))
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start)
    return buffer.subarray(0, bytesRead).toString("utf-8")
  } finally { await handle.close() }
}

export const jsonLines = (text: string): ReadonlyArray<unknown> => {
  const out: unknown[] = []
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    try { out.push(JSON.parse(trimmed)) } catch { /* truncated tail or foreign line */ }
  }
  return out
}

export const readJson = (text: string): unknown => {
  try { return JSON.parse(text) } catch { return undefined }
}
