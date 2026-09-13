/-
  THE ACCESS PREVIEW — `apps/mcp-gateway-app/src/access-preview.ts`.

  Two claims, one per half of the file. The first is the defect the file was
  written as: it re-implemented the gateway's walk and got a different answer.

  The console page answers "may this agent call this tool" before the call is
  made, and the file said it projected "the same set/allow/deny semantics the
  gateway enforces". The gateway's rule (`mcp-gateway/src/sets.ts`, modelled in
  `Formal/Sets.lean`) stops at the FIRST bound set that reaches a server and
  never consults the ones behind it. The preview read across every bound set —
  any set that reaches a server and admits the tool — so a grant in a later set
  answered for a call the gateway refuses on the earlier one, and the page said
  Allowed. It also cleared its own reason list whenever it read Allowed, which
  is the line that would have shown a reader the deny it was overriding.

  A preview that disagrees with the thing it previews is worse than no preview:
  it is read as the answer, and the call it describes then fails somewhere else.

  The second claim is what replaced it. "The same semantics, walked again" is
  agreement by coincidence, and agreement by coincidence is what broke. The
  preview now asks the gateway's own registry (`McpSetRegistry.reach` and
  `resolve`) and reads its answer, so the page's verdict and the call's outcome
  are two readings of ONE value rather than two computations that happen to
  match — and the reason the page gives is the route the engine took, not a set
  the page chose.

  The idealisation is the decision alone — one bit per set for reaching a server
  and one for admitting the tool. The set walk, the allow/deny reading and the
  reason strings are the file's, and a warning needs a test.
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

/-! ## The preview that asks the engine

Agreeing by walking again is agreement by coincidence, and agreement by
coincidence is what broke above. What replaced it is not a better walk but no
walk: the page asks the registry that decides and reads its answer. -/

/-- Which of a set's two lists refused a tool — the engine's `refusedBy`. -/
inductive Refusal where
  | deny
  | allowlist
deriving DecidableEq, Repr

/--
The engine's answer for one agent and one tool: the route it would take, and
which list refused the tool — with the invariant `sets.ts` maintains, that a
refusal is present exactly when the route does not admit.
-/
structure Route where
  /-- the set a call would go through -/
  setId : String
  /-- whether that set admits the tool -/
  admits : Bool
  /-- which of the set's lists refused it, absent exactly when it admits -/
  refusal : Option Refusal
  /-- the invariant: `resolve` is built from `refusedBy`, so this holds by
      construction rather than by check -/
  refusal_iff : refusal.isNone = admits

/-- The engine's answer: a route, or none when no bound set reaches a server. -/
abbrev Answer := Option Route

/-- The engine's own invariant, in the terms the page reads: a route that reports
    a refusal is a route that does not admit. `refusedBy` is absent exactly when
    `allowed`, so "no reason" and "admitted" are one fact rather than two that
    could come apart — which is what lets the page treat them as one. -/
theorem a_refusal_is_a_non_admission (r : Route) : r.refusal.isSome = !r.admits := by
  have h := r.refusal_iff
  cases hr : r.refusal <;> simp [hr] at h ⊢ <;> simp [h]

/-- What the gateway does with the answer. `no_server` and `denied_by_set` are
    the two refusals `gateway.ts` reports, and `carried` is the call. -/
inductive Outcome where
  | noServer
  | denied (r : Route)
  | carried (r : Route)

/-- The gateway, reading the answer. -/
def outcome : Answer → Outcome
  | none => .noServer
  | some r => if r.admits then .carried r else .denied r

/-- ...and the one bit of it the call path acts on. -/
def carries : Answer → Bool
  | none => false
  | some r => r.admits

/-- What a reason names: the set that decided, that nothing routed at all, or a
    name the door does not answer with — the three refusals the engine has no set
    to report for. -/
inductive Reason where
  | set (setId : String)
  | unrouted
  | noServerOffers
deriving DecidableEq, Repr

/-- The page, as the file now draws it: whether it says Allowed, and the set its
    reason names — nothing else, because there is nothing else to ask. -/
structure Page where
  allowed : Bool
  /-- the reason under the badge, absent exactly when allowed -/
  namedSet : Option Reason

/-- The page, reading the same answer. -/
def page : Answer → Page
  | none => ⟨false, some .unrouted⟩
  | some r => ⟨r.admits, if r.admits then none else some (.set r.setId)⟩

/--
**The rule.** The page's Allowed is the call path's decision. Not "they agree":
they are the same field of the same answer, which is why no agent and no tool
can make them differ. This is what the file's second half bought — the first
half's `the_preview_answers_where_the_gateway_answers` is a theorem about a
walk that could have been written differently, and this is a theorem about a
value that was not read twice.
-/
theorem the_page_allows_where_the_call_is_carried (a : Answer) :
    (page a).allowed = carries a := by
  cases a with
  | none => rfl
  | some r => simp [page, carries]

/-- And the refusal it reports is the gateway's own: a route that refuses is
    denied by the set, named — so the page cannot say Denied for a call the
    gateway carried. -/
theorem the_page_denies_where_the_gateway_refuses (r : Route) (hr : r.admits = false) :
    (page (some r)).allowed = false ∧ outcome (some r) = .denied r := by
  simp [page, outcome, hr]

/--
The reason names the set that decided: the page does not choose which set to
explain, it reports the one the engine routed to. An allowance names none, so
the page cannot claim a refusal where there was none.
-/
theorem a_refusal_names_the_set_that_decided (r : Route) (h : r.admits = false) :
    (page (some r)).namedSet = some (.set r.setId) ∧ (page (some r)).allowed = false := by
  simp [page, h]

/-- And when nothing routes, the reason says that rather than naming a set the
    engine never chose. -/
theorem nothing_routed_names_no_set :
    (page (none : Answer)).namedSet = some .unrouted
      ∧ (page (none : Answer)).allowed = false := by
  simp [page]

/-- No refusal without a reason: wherever the page says Denied it names one,
    which is the line the old file did not have — it cleared its reason list
    whenever it read Allowed, and had nothing to say when it read Denied. -/
theorem every_refusal_has_a_reason (a : Answer) (h : (page a).allowed = false) :
    (page a).namedSet.isSome = true := by
  cases a with
  | none => rfl
  | some r => simp [page] at h ⊢; simp [h]

/-- And an allowance names none: the two are one fact read twice, not two
    fields that could disagree. -/
theorem an_allowance_names_no_set (a : Answer) (h : (page a).allowed = true) :
    (page a).namedSet = none := by
  cases a with
  | none => exact absurd h (by simp [page])
  | some r => simp [page] at h ⊢; simp [h]

/--
The control for the second half: a page that reads something other than the
engine's answer is not a function of it, and can disagree — which is the first
half of this file, said about the same fixture.
-/
theorem a_page_that_reads_something_else_can_disagree :
    ∃ (sets : List Bound), acrossEverySet sets ≠ firstReachable sets :=
  ⟨[⟨true, false⟩, ⟨true, true⟩], by decide⟩

/-! ## The question the page asks

The badge answers "may this agent reach this tool". A name the door does not
advertise stands for no pair, so no call could ever name it — and the engine has
no pair to answer about, but it does have an answer to the walk *without* a tool,
which is the walk the file used to read. That walk admits whenever the agent is
bound to a set that reaches a server, so the page said Allowed for a name
`tools/list` never answers with, and the call it described was refused by the
door before any set was read. The verdict is therefore the engine's answer to a
question the door can be asked, and the door's own catalog is what says whether
it can be asked at all. -/

/-- The operator's question, as the page can ask it: a name `tools/list` answers
    with, which stands for the pair a call names — or a name nothing offers,
    which stands for nothing at all. -/
inductive Asked where
  | advertised (answer : Answer)
  | unadvertised

/-- The page as the file has it: a name nothing offers is a refusal of its own,
    and the walk without a tool is never read for it. -/
def askedPage : Asked → Page
  | .unadvertised => ⟨false, some .noServerOffers⟩
  | .advertised answer => page answer

/-- The page as it was: for a name nothing offers it read the walk it could still
    make, and showed that answer under the badge. -/
def walkWithoutTool : Asked → Answer → Page
  | .unadvertised, without => page without
  | .advertised answer, _ => page answer

/-- The page refuses a name nothing offers, and says which fact refused it. -/
theorem the_page_refuses_a_name_nothing_offers :
    (askedPage .unadvertised).allowed = false
      ∧ (askedPage .unadvertised).namedSet = some .noServerOffers := by
  exact ⟨rfl, rfl⟩

/-- The control: the walk without a tool admits for an agent that is bound to a
    set whose server is up — the ordinary live case — so the page that read it
    said Allowed for a tool the door could not carry. -/
theorem the_walk_without_a_tool_admits_for_a_bound_agent :
    (walkWithoutTool .unadvertised (some ⟨"platform", true, none, by simp⟩)).allowed = true := by
  rfl

/-- And for that same fixture the file's page refuses it, which is the whole of
    what the conjunct buys. -/
theorem the_page_refuses_where_the_walk_without_a_tool_admits :
    (askedPage .unadvertised).allowed = false
      ∧ (walkWithoutTool .unadvertised (some ⟨"platform", true, none, by simp⟩)).allowed = true :=
  ⟨rfl, rfl⟩

/-- A name the door advertises is answered by the engine and by nothing else, so
    the page cannot invent a refusal for a tool that can be called. -/
theorem an_advertised_name_is_answered_by_the_engine (answer : Answer) :
    askedPage (.advertised answer) = page answer := by
  rfl

end AccessPreview
