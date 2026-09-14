export interface Cut {
  readonly start: number
  readonly end: number
}

export const skipString = (text: string, at: number): number => {
  const quote = text[at]!
  let index = at + 1
  while (index < text.length && text[index] !== quote) index += text[index] === "\\" ? 2 : 1
  return index + 1
}

export const cutOfLine = (text: string, start: number, end: number): Cut => {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1
  const newline = text.indexOf("\n", end)
  const lineEnd = newline === -1 ? text.length : newline
  const alone = text.slice(lineStart, start).trim() === "" && text.slice(end, lineEnd).trim() === ""
  return alone ? { start: lineStart, end: newline === -1 ? text.length : newline + 1 } : { start, end }
}

const outermost = (cuts: readonly Cut[]): readonly Cut[] => {
  const kept: Cut[] = []
  for (const cut of [...cuts].sort((left, right) => left.start - right.start || right.end - left.end)) {
    if (kept.length === 0 || cut.start >= kept[kept.length - 1]!.end) kept.push(cut)
  }
  return kept
}

export const applyCuts = (text: string, cuts: readonly Cut[]): string => {
  let out = text
  for (const cut of [...outermost(cuts)].sort((left, right) => right.start - left.start)) {
    out = out.slice(0, cut.start) + out.slice(cut.end)
  }
  return out.split("\n").map((line) => line.trimEnd()).join("\n").replace(/^[ \t]*\n+/, "").replace(/\n*$/, "\n")
}
