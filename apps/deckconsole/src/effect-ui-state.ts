export const deckState = {
  deck: { sessions: [], pending: [], kinds: [] },
  launchers: { launchers: [] },
  presets: { presets: [] },
  create: {
    kind: "demo",
    sessionId: "",
    prompt: "",
    config: { consent: { autoApproveTools: ["", "", "", ""], defaultDecision: "ask" } },
  },
  message: { text: "" },
  result: { open: undefined, session: undefined, turn: undefined, retry: undefined, consent: undefined, launcher: undefined },
  opened: { sessionId: "", turns: [], consent: [] },
}
