/**
 * What this view holds before anything has been read.
 *
 * Every root here is declared rather than left to appear, because a `repeat` and
 * a guard both read a path, and a path nothing declared reads as nothing — which
 * is how a list renders no rows and says nothing about why. The shapes are the
 * ones the deck's own routes answer with, so a source's body lands on a declared
 * shape rather than replacing it with a second one.
 *
 * `result` is one root per press family. A refusal is read where the press was,
 * and two presses that share a root share their readout: a failed close would
 * paint its sentence under the consent queue as well.
 *
 * `opened` is the transcript read, and `ok` is the part of it that matters. The
 * read's answer replaces the whole root, so `ok` is absent until a read succeeds
 * and false once one fails; the screen that shows the transcript can therefore
 * tell "the read answered" from "the read has not run", which is the difference
 * between the room and a skeleton (§9.2).
 */
export const deckState = {
  deck: { sessions: [], pending: [], kinds: [] },
  launchers: { launchers: [] },
  presets: { presets: [] },
  create: {
    kind: "demo",
    sessionId: "",
    prompt: "",
    /**
     * The consent policy a session is opened under (`flows.md` §7.8 dead end 2,
     * `plan.md` §8 row 6). The deck's legacy page set this; §5 deletes that page,
     * so this root is now the only place the capability lives, and a session
     * opened without it can never be given one afterwards.
     *
     * `autoApproveTools` is a list, and the language has exactly one way to write
     * into an array: a path with the slot's own index in it (`/$0`), because a
     * `bind` records a state path and a `$bindItem` is only emitted for an
     * action's parameter. So the list is seeded dense — one slot per field the
     * form draws — and a slot nobody filled stays the empty string.
     *
     * That density is the point, not a detail. The deck keeps this list only
     * while every entry is a string, so a sparse seed would be a hole: one
     * unfilled slot and the whole policy is dropped rather than the one tool,
     * silently, at the moment the session opens. An empty string is a name no
     * tool can have, so the unfilled slots are carried and match nothing.
     */
    config: { consent: { autoApproveTools: ["", "", "", ""], defaultDecision: "ask" } },
  },
  message: { text: "" },
  result: { open: undefined, session: undefined, turn: undefined, retry: undefined, consent: undefined, launcher: undefined },
  opened: { sessionId: "", turns: [], consent: [] },
}
