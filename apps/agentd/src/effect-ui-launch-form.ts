/**
 * Asking one fleet agent for one turn.
 *
 * The press is not a picker: it lives inside the agent's own answer, so the
 * identity it runs as is the one the address named and the answer confirmed. A
 * launch that named its agent through a second control would be a second way to
 * say what the room already said, and the two could disagree.
 *
 * The answer to the press is shown because it is the point of the gesture: the
 * center reads the machine and the dialect from the identity at the moment of
 * queueing, so an operator who reads the answer back sees where the work
 * actually went rather than where they might have guessed. It stays in the room
 * the press was made in.
 *
 * The form asks for a directory and a prompt and nothing else. A task node is
 * the one thing this surface does not name: a turn started by hand belongs to no
 * task, and the field is absent rather than empty for exactly that reason. A
 * caller that has one, an agent picking up board work, names it, and this is not
 * that caller.
 *
 * The press is not gated, and that has to be said out loud. `flows.md` §7.2 calls
 * for this write to be a protected one: a decision, unless the operator holds a
 * standing grant. The declaration language cannot say that. `UiActionSpec`
 * carries a method, a url, a result and a screen, and the host's own
 * `Operation.access` is `read` or `write` with nothing in between, so a press is
 * exactly as gated as the route behind it. Writing a claim of a gate here that
 * nothing enforces would be worse than having none, because the next reader
 * would believe it.
 */
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
