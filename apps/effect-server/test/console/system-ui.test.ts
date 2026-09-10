import { expect, test } from "bun:test"
import { consoleSystemUi } from "../../src/console/system-ui.ts"

test("system UI uses the same App model for Dock, Home and Settings", () => {
  const spec = consoleSystemUi({ ui: [{ interfaceId: "demo", title: "Demo" }], config: [{ appId: "board", title: "Board" }] })
  expect(spec.elements["0"].props?.items).toEqual([
    { id: "demo", title: "Demo", surface: "view", persistent: true }, { id: "board", title: "Board", surface: "config", persistent: true },
    { id: "settings", title: "Settings", surface: "settings", persistent: true },
  ])
  expect(spec.elements["1"].props?.widgets).toBeUndefined()
  expect(Object.values(spec.elements).map((element) => element.type).slice(0, 3)).toEqual(["Dock", "Springboard", "SettingsGroup"])
})
