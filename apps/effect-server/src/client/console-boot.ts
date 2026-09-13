import type { ConsoleCatalogue } from "./console-plan.ts"

const get = async (path: string): Promise<unknown> => {
  const response = await fetch(path, { cache: "no-store" })
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.json()
}

export const loadCatalogue = (): Promise<ConsoleCatalogue> => get("/-/apps") as Promise<ConsoleCatalogue>

/** The status line reports the host's own plane table; it invents no second status source. */
export const loadStatusLine = async (): Promise<string> => {
  try {
    const planes = await get("/-/status")
    if (!Array.isArray(planes)) return "Status unavailable"
    return `${String(planes.filter((plane) => (plane as { enabled?: boolean }).enabled === true).length)} services active`
  } catch { return "Status unavailable" }
}
