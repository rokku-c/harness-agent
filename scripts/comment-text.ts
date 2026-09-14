import { stripLean, stripTypeScript } from "./comment-cut.ts"
import { applyCuts, cutOfLine, type Cut } from "./comment-lines.ts"

export const stripHashComments = (text: string): string => {
  const cuts: Cut[] = []
  let index = 0
  while (index < text.length) {
    if (text[index] !== "#") { index += 1; continue }
    const before = index === 0 ? "\n" : text[index - 1]!
    const lineStart = text.lastIndexOf("\n", index - 1) + 1
    const quotes = (text.slice(lineStart, index).match(/"/g) ?? []).length
    if (/\s/.test(before) && quotes % 2 === 0) {
      const newline = text.indexOf("\n", index)
      cuts.push(cutOfLine(text, index, newline === -1 ? text.length : newline))
      index = newline === -1 ? text.length : newline + 1
      continue
    }
    index += 1
  }
  return applyCuts(text, cuts)
}

export const stripBlockComments = (text: string): string => {
  const cuts: Cut[] = []
  let index = 0
  while (index < text.length) {
    if (!text.startsWith("/*", index)) { index += 1; continue }
    const close = text.indexOf("*/", index)
    const end = close === -1 ? text.length : close + 2
    cuts.push(cutOfLine(text, index, end))
    index = end
  }
  return applyCuts(text, cuts)
}

export const stripShell = (text: string): string => {
  const newline = text.indexOf("\n")
  const head = text.startsWith("#!") && newline !== -1 ? text.slice(0, newline + 1) : ""
  return head + stripHashComments(text.slice(head.length))
}

export const stripOf = (path: string, text: string): string => {
  if (path.endsWith(".lean")) return stripLean(text)
  if (path.endsWith(".css")) return stripBlockComments(text)
  if (/\.(ya?ml|toml)$/.test(path) || path.endsWith(".gitignore")) return stripHashComments(text)
  if (path.endsWith(".sh")) return stripShell(text)
  return stripTypeScript(path, text)
}
