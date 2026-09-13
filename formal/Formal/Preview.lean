/-
  THE ACCESS PREVIEW — `apps/mcp-gateway-app/src/access-audit.ts`.

  The console page answers "may this agent call this tool" before the call is
  made, and the file says it projects "the same set/allow/deny semantics the
  gateway enforces". The gateway's rule (`mcp-gateway/src/sets.ts`, modelled in
  `Formal/Sets.lean`) stops at the FIRST bound set that reaches a server and
  never consults the ones behind it. The preview read across every bound set —
  any set that reaches a server and admits the tool — so a grant in a later set
  answered for a call the gateway refuses on the earlier one, and the page said
  Allowed. It also cleared its own reason list whenever it read Allowed, which
  is the line that would have shown a reader the deny it was overriding.

  A preview that disagrees with the thing it previews is worse than no preview:
  it is read as the answer, and the call it describes then fails somewhere else.

  The idealisation is the decision alone — one bit per set for reaching a
  server and one for admitting the tool. The set walk, the allow/deny reading
  and the reason strings are the file's, and a warning needs a test.
-/

namespace AccessPreview

/-- One bound set, as far as a decision cares: whether it reaches a server at
    all, and whether it admits the tool being asked about. -/
structure Bound where
  reachable : Bool
  admits : Bool
deriving DecidableEq, Repr

/-- The gateway's rule: the first bound set that reaches a server answers, and
    the ones behind it are never consulted. -/
def gateway (sets : List Bound) : Option Bool :=
  match sets.find? (·.reachable) with
  | some s => some s.admits
  | none => none

/-- The preview as the file had it: any set that reaches a server and admits
    the tool. -/
def acrossEverySet (sets : List Bound) : Bool :=
  sets.any (fun s => s.reachable && s.admits)

/-- The preview now: the same walk the gateway makes, with no verdict from no
    set — the same `false` the gateway's own denial produces. -/
def firstReachable (sets : List Bound) : Bool := (gateway sets).getD false

/--
The bug, as one fixture: the first set reaches a server and denies, the second
reaches one and grants. The gateway refuses.
-/
theorem the_gateway_refuses_what_the_later_set_grants :
    gateway [⟨true, false⟩, ⟨true, true⟩] = some false := by
  decide

/-- And the preview read across both sets said Allowed for it. -/
theorem the_reading_across_sets_grants_it :
    acrossEverySet [⟨true, false⟩, ⟨true, true⟩] = true := by
  decide

/-- The preview now refuses it, which is what the page was claiming to do. -/
theorem the_preview_refuses_it : firstReachable [⟨true, false⟩, ⟨true, true⟩] = false := by
  decide

/--
The claim both readings make, in one statement: wherever the gateway has a
verdict, the preview has that verdict. This is what "the same semantics" means,
and the reason reading across the sets is the wrong operation rather than
merely a different one.
-/
theorem the_preview_answers_where_the_gateway_answers (sets : List Bound) (v : Bool)
    (h : gateway sets = some v) : firstReachable sets = v := by
  simp [firstReachable, h]

/--
The control: the two readings are not the same function, so the theorem above
is about the preview that changed and not about a tautology. Where the FIRST
reachable set grants they agree, and where it denies they need not — which is
exactly the fixture above.
-/
theorem the_readings_agree_where_the_first_set_grants :
    acrossEverySet [⟨true, true⟩, ⟨true, false⟩] = firstReachable [⟨true, true⟩, ⟨true, false⟩] := by
  decide

/-- A set that reaches no server is skipped, so a later one answers — and here
    the two readings agree, which is why the bug needed a reachable first set. -/
theorem a_set_with_no_server_is_skipped :
    gateway [⟨false, false⟩, ⟨true, true⟩] = some true
      ∧ firstReachable [⟨false, false⟩, ⟨true, true⟩] = true := by
  decide

/-- No bound set reaches a server: the gateway has no verdict, and the preview
    denies rather than reading a set that is not there. -/
theorem no_reachable_set_is_a_denial :
    gateway [⟨false, true⟩] = none ∧ firstReachable [⟨false, true⟩] = false := by
  decide

/-- And with nothing bound at all, likewise. -/
theorem nothing_bound_is_a_denial :
    gateway ([] : List Bound) = none ∧ firstReachable ([] : List Bound) = false := by
  decide

end AccessPreview
