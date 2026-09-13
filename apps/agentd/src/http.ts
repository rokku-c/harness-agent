/** The one answer shape agentd's HTTP surface writes outside an operation. */
export const json = (value: unknown, status = 200): Response => Response.json(value, { status })
