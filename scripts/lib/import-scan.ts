/** Which modules a source file pulls in — static and dynamic import specifiers. */

export const importSpecifiers = (source: string): string[] => {
  const out: string[] = []
  const fromRe = /(?:^|\s)(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/g
  const dynRe = /import\s*\(\s*["']([^"']+)["']/g
  for (const re of [fromRe, dynRe]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(source)) !== null) out.push(m[1])
  }
  return out
}

export const isBuiltinSpecifier = (spec: string): boolean => spec.startsWith("node:") || spec.startsWith("bun:")
