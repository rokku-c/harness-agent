import { expect, test } from "bun:test"
import { createFormModel, createFormParser } from "@effect-agent/effect-ui"
import { createConfigApi } from "../config-api.ts"
import { createConfigEdits } from "../config-edits.ts"

test("clearing previously loaded optional boolean, string and enum produces explicit deletion", () => {
  const edits = createConfigEdits()
  const value = { captureBodies: true, apiKey: "previous", mode: "fast" }
  edits.loaded(value)
  const form = createFormModel().create("gateway", { properties: {
    captureBodies: { type: "boolean" }, apiKey: { type: "string" }, mode: { type: "string", enum: ["fast", "slow"] },
  } }, value)
  form.root.fields[0].value = undefined
  form.root.fields[1].value = ""
  form.root.fields[2].value = undefined
  expect(edits.patch(createFormParser().parse(form))).toEqual({
    override: {}, unset: ["captureBodies", "apiKey", "mode"],
  })
})

test("false, zero, present strings and replacement arrays are retained; deletion is top-level only", () => {
  const edits = createConfigEdits()
  edits.loaded({ captureBodies: true, port: 80, label: "old", providers: [{ apiType: "openai.chat", apiKey: "old" }], auth: { key: "old" } })
  const override = { captureBodies: false, port: 0, label: "", providers: [], auth: {} }
  expect(edits.patch(override)).toEqual({ override, unset: [] })
  expect(edits.patch({ captureBodies: false, port: 0, label: "", providers: [] }).unset).toEqual(["auth"])
})

test("successful reload replaces the baseline, including optional schema defaults reappearing", () => {
  const edits = createConfigEdits()
  const loaded = { captureBodies: true }
  edits.loaded(loaded)
  Object.assign(loaded, { unrelated: true })
  expect(edits.patch({}).unset).toEqual(["captureBodies"])
  edits.loaded({})
  expect(edits.patch({})).toEqual({ override: {}, unset: [] })
  edits.loaded({ captureBodies: false })
  expect(edits.patch({}).unset).toEqual(["captureBodies"])
})

test("failed saves preserve the baseline and resend the same deletions on retry", async () => {
  const edits = createConfigEdits(), requests: unknown[] = []
  edits.loaded({ captureBodies: true })
  const api = createConfigApi(async (_url, init) => {
    requests.push(JSON.parse(init!.body as string))
    const ok = requests.length > 1
    return Response.json({ appId: "gateway", ok, pendingRestart: true, error: ok ? undefined : "rejected" }, { status: ok ? 200 : 409 })
  })
  const save = () => {
    const { override, unset } = edits.patch({})
    return api.save("gateway", override, "restart", unset)
  }
  await expect(save()).rejects.toThrow("HTTP 409: rejected")
  await expect(save()).resolves.toMatchObject({ ok: true, pendingRestart: true })
  expect(requests).toEqual([
    { override: {}, strategy: "restart", unset: ["captureBodies"] },
    { override: {}, strategy: "restart", unset: ["captureBodies"] },
  ])
  expect(edits.patch({}).unset).toEqual(["captureBodies"])
  edits.loaded({})
  expect(edits.patch({}).unset).toEqual([])
})
