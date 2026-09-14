import ts from "typescript"
import { applyCuts, cutOfLine, skipString, type Cut } from "./comment-lines.ts"

export const stripTypeScript = (file: string, text: string): string => {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
  const cuts: Cut[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isJsxExpression(node) && node.expression === undefined) {
      cuts.push({ start: node.getFullStart(), end: node.getEnd() })
      return
    }
    for (const range of ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []) {
      cuts.push(cutOfLine(text, range.pos, range.end))
    }
    for (const range of ts.getTrailingCommentRanges(text, node.getEnd()) ?? []) {
      cuts.push(cutOfLine(text, range.pos, range.end))
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return applyCuts(text, cuts)
}

const endOfBlock = (text: string, at: number): number => {
  let depth = 0
  let cursor = at
  while (cursor < text.length) {
    if (text.startsWith("/-", cursor)) { depth += 1; cursor += 2; continue }
    if (text.startsWith("-/", cursor)) {
      depth -= 1
      cursor += 2
      if (depth === 0) return cursor
      continue
    }
    cursor += 1
  }
  return text.length
}

export const stripLean = (text: string): string => {
  const cuts: Cut[] = []
  let index = 0
  while (index < text.length) {
    if (text[index] === '"') { index = skipString(text, index); continue }
    if (text.startsWith("--", index)) {
      const newline = text.indexOf("\n", index)
      cuts.push(cutOfLine(text, index, newline === -1 ? text.length : newline))
      index = newline === -1 ? text.length : newline + 1
      continue
    }
    if (text.startsWith("/-", index)) {
      const end = endOfBlock(text, index)
      cuts.push(cutOfLine(text, index, end))
      index = end
      continue
    }
    index += 1
  }
  return applyCuts(text, cuts)
}
