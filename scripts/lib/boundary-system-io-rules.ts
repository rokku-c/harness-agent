import { scanSystemIo } from "./system-io-scan.ts"
import type { Finding } from "./boundary-finding.ts"

export const systemIoFindings = (fileRel: string, source: string): Finding[] => {
  const hit = scanSystemIo(source)
  if (hit === undefined) return []
  return [
    {
      severity: "error",
      rule: "R5-system-io",
      file: fileRel,
      specifier: hit.match,
      message: `app uses ${hit.label} directly; go through a repo abstraction package instead`,
    },
  ]
}
