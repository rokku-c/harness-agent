namespace GatewayConsole

inductive Listing where
  | listed
  | failed (detail : String)
  | notAsked
deriving DecidableEq, Repr

structure Report where
  loaded : List String
  failed : List (String × String)

def column (report : Report) (live : Bool) (serverId : String) : Listing :=
  if !live then .notAsked
  else
    match report.failed.find? (·.1 == serverId) with
    | some failure => .failed failure.2
    | none => if report.loaded.contains serverId then .listed else .notAsked

def listed (report : Report) (serverId : String) : Bool := report.loaded.contains serverId

theorem the_column_says_listed_exactly_where_the_round_answered (report : Report)
    (serverId : String) (nothing_said : report.failed.find? (·.1 == serverId) = none) :
    column report true serverId = .listed ↔ report.loaded.contains serverId = true := by
  simp [column, nothing_said]

theorem the_column_never_invents_a_failure (report : Report) (serverId detail : String)
    (said : report.failed.find? (·.1 == serverId) = some (serverId, detail)) :
    column report true serverId = .failed detail := by
  simp [column, said]

theorem a_server_that_is_down_is_not_asked (report : Report) (serverId : String) :
    column report false serverId = .notAsked := by
  simp [column]

theorem a_two_state_column_cannot_tell_down_from_failed :
    listed ⟨[], []⟩ "gh" = false
      ∧ column ⟨[], []⟩ false "gh" = .notAsked
      ∧ column ⟨[], [("gh", "refused")]⟩ true "gh" = .failed "refused"
      ∧ column ⟨[], [("gh", "refused")]⟩ true "gh" ≠ column ⟨[], []⟩ false "gh" := by
  refine ⟨rfl, rfl, ?_, ?_⟩
  · simp [column]
  · simp [column]

end GatewayConsole
