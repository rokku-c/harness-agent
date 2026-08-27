import { Effect } from "effect"
import { mountWebUi } from "@effect-agent/webui"
import { makeDemoRepr } from "../demo-core.js"

const repr = await Effect.runPromise(makeDemoRepr())
const root = document.querySelector<HTMLElement>("#app")
if (!root) throw new Error("Missing #app")
const mounted = await Effect.runPromise(mountWebUi(root, repr))

window.addEventListener("beforeunload", () => {
  Effect.runFork(mounted.unmount.pipe(Effect.zipRight(repr.close)))
})
