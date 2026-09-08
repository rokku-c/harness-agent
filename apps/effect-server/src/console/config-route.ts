import { formToJsonSpec } from "@effect-agent/effect-ui"
import type { ConfigRegistry } from "@effect-agent/effect-config"
import type { ConfigRuntime } from "../config-runtime/types.ts"

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)

/** Both read surfaces and the Config App use the same durable configuration. */
export const configRoute = async (
  request: Request, id: string, configs: ConfigRegistry, runtime: ConfigRuntime, applyOnly = false,
): Promise<Response> => {
  const schema = configs.schemaFor(id)
  if (schema === undefined) return Response.json({ ok: false, error: `No config declared: ${id}` }, { status: 404 })
  if (request.method === "GET" && !applyOnly) {
    const out = runtime.read(id)
    return Response.json({ ...out, kind: "config", id, schema,
      jsonSpec: formToJsonSpec(id, schema as never, out.ok ? out.value as Record<string, unknown> : undefined),
    }, { status: out.ok ? 200 : 400 })
  }
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "GET, POST" } })
  if (applyOnly) {
    const out = await runtime.apply(id)
    return Response.json(out, { status: out.ok ? 200 : 409 })
  }
  let body: unknown
  try { body = await request.json() } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }) }
  if (!record(body) || !record(body.override) || (body.strategy !== "apply" && body.strategy !== "restart")) {
    return Response.json({ ok: false, error: "Expected {override: object, strategy: apply|restart}" }, { status: 400 })
  }
  if (body.unset !== undefined && (!Array.isArray(body.unset) || body.unset.some((key) => typeof key !== "string"))) {
    return Response.json({ ok: false, error: "unset must be an array of top-level keys" }, { status: 400 })
  }
  const out = await runtime.save(id, body.override, body.strategy, body.unset as string[] | undefined)
  return Response.json(out, { status: out.ok ? 200 : 400 })
}
