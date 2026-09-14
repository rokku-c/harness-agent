export const json = (value: unknown, status = 200): Response => Response.json(value, { status })
