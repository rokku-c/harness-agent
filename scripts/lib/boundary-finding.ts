/** One boundary violation, and the single line the checker prints for it. */

export interface Finding {
  readonly severity: "error" | "warn"
  readonly rule: string
  readonly file: string
  readonly specifier: string
  readonly message: string
}

export const formatFinding = (f: Finding): string => {
  const tag = f.severity === "error" ? "ERROR" : "warn "
  return `${tag} [${f.rule}] ${f.file}: ${f.specifier} — ${f.message}`
}
