import { field, press, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { answer, answeredChip } from "./effect-ui-answer.ts"
import { AGENT_LAUNCH, PROMPT, WORKDIR } from "./effect-ui-paths.ts"
import { readFailed, readFailure } from "./effect-ui-read.ts"

export const launchForm: readonly UiNodeSpec[] = [
  field("Working directory", {
    component: "TextField.Root", props: { placeholder: "/absolute/path" }, bind: WORKDIR,
  }),
  field("Prompt", {
    component: "TextArea", props: { placeholder: "what this fleet agent should do" }, bind: PROMPT,
  }),
  row([press("Run a turn", "agentd.launch",
    { workdir: { state: WORKDIR }, prompt: { state: PROMPT } }, { variant: "solid", size: "2" })]),
  answer(`${AGENT_LAUNCH}/ok`, [
    answeredChip("Machine", `${AGENT_LAUNCH}/launch/machineId`),
    field("State", row([{ component: "Badge", props: { variant: "soft" }, bind: `${AGENT_LAUNCH}/launch/state` }])),
  ]),
  readFailure(readFailed(`${AGENT_LAUNCH}/error`), "Run a turn was refused.", `${AGENT_LAUNCH}/error`, "agentd.launch"),
]
