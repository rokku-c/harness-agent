/-
  WHAT EACH SERVER ANSWERED — `apps/mcp-gateway-app/src/server-listings.ts`.

  The console's Topology screen shows one row per registered server, and the
  column the operator reads when the door offers nothing is the one that says
  what the gateway asked that server and what came back. The file puts that fact
  in the server's own row rather than in a list beside it — and it is three
  states, not two, because a server that is offline is never asked at all.

  **The third state is why the report alone will not do** —
  `a_two_state_column_cannot_tell_down_from_failed`. `catalog-load.ts` reports
  which servers it loaded and which threw, and it is given only the live ones
  (`Formal/CatalogLoad.lean`), so a server that is down appears in neither list:
  a column reading the report alone paints it exactly as it paints a server whose
  listing threw with a reason, and nothing on the page says which happened.

  **The column is the round's own answer** —
  `the_column_says_listed_exactly_where_the_round_answered` and
  `the_column_never_invents_a_failure`. It is drawn from the report rather than
  computed beside it, so the page cannot say `listed` for a server the door
  offers nothing through, nor name a failure the round did not record. What the
  door offers is `Formal/CatalogLoad.lean`'s subject; this file only says the
  column is that answer in words.

  Idealisation: a server is its id, whether it is live, and which of the report's
  two lists the round put it in — the registry record, the status word and the
  failure's detail text are not restated.
-/

namespace GatewayConsole

/-- What the round did about one server, as the console says it. -/
inductive Listing where
  | listed
  | failed (detail : String)
  | notAsked
deriving DecidableEq, Repr

/-- The report, as the console reads it: the ids the round loaded, and the ids it
    could not, each with what the listing said. -/
structure Report where
  loaded : List String
  failed : List (String × String)

/-- The file's column for one server: its own status first, then which list the
    round put it in. -/
def column (report : Report) (live : Bool) (serverId : String) : Listing :=
  if !live then .notAsked
  else
    match report.failed.find? (·.1 == serverId) with
    | some failure => .failed failure.2
    | none => if report.loaded.contains serverId then .listed else .notAsked

/-- The column reading the report alone: two states, so a server that is down and
    a server whose listing threw read the same. -/
def listed (report : Report) (serverId : String) : Bool := report.loaded.contains serverId

/-- A live server the round answered reads `listed`, and nothing else does. -/
theorem the_column_says_listed_exactly_where_the_round_answered (report : Report)
    (serverId : String) (nothing_said : report.failed.find? (·.1 == serverId) = none) :
    column report true serverId = .listed ↔ report.loaded.contains serverId = true := by
  simp [column, nothing_said]

/-- A server the round could not list reads `failed`, with the reason the round
    recorded — the page never names a failure of its own. -/
theorem the_column_never_invents_a_failure (report : Report) (serverId detail : String)
    (said : report.failed.find? (·.1 == serverId) = some (serverId, detail)) :
    column report true serverId = .failed detail := by
  simp [column, said]

/-- A server that is offline is not asked, whatever the report says about it. -/
theorem a_server_that_is_down_is_not_asked (report : Report) (serverId : String) :
    column report false serverId = .notAsked := by
  simp [column]

/-- The control: the two-state reading cannot tell the two apart. A server that is
    down and a server whose listing threw are the same `false` to it, so the page
    built from the report alone would leave the one case an operator meets most
    often with nothing said about it. -/
theorem a_two_state_column_cannot_tell_down_from_failed :
    listed ⟨[], []⟩ "gh" = false
      ∧ column ⟨[], []⟩ false "gh" = .notAsked
      ∧ column ⟨[], [("gh", "refused")]⟩ true "gh" = .failed "refused"
      ∧ column ⟨[], [("gh", "refused")]⟩ true "gh" ≠ column ⟨[], []⟩ false "gh" := by
  refine ⟨rfl, rfl, ?_, ?_⟩
  · simp [column]
  · simp [column]

end GatewayConsole
