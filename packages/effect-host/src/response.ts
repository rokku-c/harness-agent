export const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } })

export const errorDetail = (error: unknown): string => error instanceof Error ? error.message : String(error)
