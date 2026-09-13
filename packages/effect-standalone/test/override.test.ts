import { expect, test } from "bun:test"
import { startStandaloneApp } from "../src/index.ts"
import { soloApp } from "./fixtures.ts"

const hostedWith = (options: { config?: unknown; override?: unknown }) =>
  startStandaloneApp({ app: soloApp(), port: 0, ...options })

test("an override layer wins over the yaml layer, and is named as the source", async () => {
  const hosted = await hostedWith({ config: { label: "from-yaml" }, override: { label: "from-caller" } })
  try {
    // `config` is the record the app itself reads (`activeConfig`), not a preview
    // computed beside it: one store, one committed value.
    expect(hosted.config.value).toEqual({ label: "from-caller" })
    expect(hosted.config.sources).toEqual({ label: "override" })
  } finally { await hosted.stop() }
})

test("without an override the yaml layer is what runs, exactly as before", async () => {
  const hosted = await hostedWith({ config: { label: "from-yaml" } })
  try {
    expect(hosted.config.value).toEqual({ label: "from-yaml" })
    expect(hosted.config.sources).toEqual({ label: "yaml" })
  } finally { await hosted.stop() }
})

test("an empty override adds nothing and removes nothing", async () => {
  const hosted = await hostedWith({ config: { label: "from-yaml" }, override: {} })
  try {
    // A layer that says nothing must not blank the one below it — that is the
    // whole difference between merging an override and replacing the layer.
    expect(hosted.config.value).toEqual({ label: "from-yaml" })
    expect(hosted.config.sources).toEqual({ label: "yaml" })
  } finally { await hosted.stop() }
})

test("with no layer at all the value comes from the schema, and says so", async () => {
  const hosted = await hostedWith({})
  try {
    expect(hosted.config.value).toEqual({ label: "solo" })
    expect(hosted.config.sources).toEqual({ label: "default" })
  } finally { await hosted.stop() }
})
