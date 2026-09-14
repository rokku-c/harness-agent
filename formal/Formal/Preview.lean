namespace AccessPreview

structure Bound where
  reachable : Bool
  admits : Bool
deriving DecidableEq, Repr

def gateway (sets : List Bound) : Option Bool :=
  match sets.find? (·.reachable) with
  | some s => some s.admits
  | none => none

def acrossEverySet (sets : List Bound) : Bool :=
  sets.any (fun s => s.reachable && s.admits)

def firstReachable (sets : List Bound) : Bool := (gateway sets).getD false

theorem the_gateway_refuses_what_the_later_set_grants :
    gateway [⟨true, false⟩, ⟨true, true⟩] = some false := by
  decide

theorem the_reading_across_sets_grants_it :
    acrossEverySet [⟨true, false⟩, ⟨true, true⟩] = true := by
  decide

theorem the_preview_refuses_it : firstReachable [⟨true, false⟩, ⟨true, true⟩] = false := by
  decide

theorem the_preview_answers_where_the_gateway_answers (sets : List Bound) (v : Bool)
    (h : gateway sets = some v) : firstReachable sets = v := by
  simp [firstReachable, h]

theorem the_readings_agree_where_the_first_set_grants :
    acrossEverySet [⟨true, true⟩, ⟨true, false⟩] = firstReachable [⟨true, true⟩, ⟨true, false⟩] := by
  decide

theorem a_set_with_no_server_is_skipped :
    gateway [⟨false, false⟩, ⟨true, true⟩] = some true
      ∧ firstReachable [⟨false, false⟩, ⟨true, true⟩] = true := by
  decide

theorem no_reachable_set_is_a_denial :
    gateway [⟨false, true⟩] = none ∧ firstReachable [⟨false, true⟩] = false := by
  decide

theorem nothing_bound_is_a_denial :
    gateway ([] : List Bound) = none ∧ firstReachable ([] : List Bound) = false := by
  decide


inductive Refusal where
  | deny
  | allowlist
deriving DecidableEq, Repr

structure Route where
  setId : String
  admits : Bool
  refusal : Option Refusal
  refusal_iff : refusal.isNone = admits

abbrev Answer := Option Route

theorem a_refusal_is_a_non_admission (r : Route) : r.refusal.isSome = !r.admits := by
  have h := r.refusal_iff
  cases hr : r.refusal <;> simp [hr] at h ⊢ <;> simp [h]

inductive Outcome where
  | noServer
  | denied (r : Route)
  | carried (r : Route)

def outcome : Answer → Outcome
  | none => .noServer
  | some r => if r.admits then .carried r else .denied r

def carries : Answer → Bool
  | none => false
  | some r => r.admits

inductive Reason where
  | set (setId : String)
  | unrouted
  | noServerOffers
deriving DecidableEq, Repr

structure Page where
  allowed : Bool
  namedSet : Option Reason

def page : Answer → Page
  | none => ⟨false, some .unrouted⟩
  | some r => ⟨r.admits, if r.admits then none else some (.set r.setId)⟩

theorem the_page_allows_where_the_call_is_carried (a : Answer) :
    (page a).allowed = carries a := by
  cases a with
  | none => rfl
  | some r => simp [page, carries]

theorem the_page_denies_where_the_gateway_refuses (r : Route) (hr : r.admits = false) :
    (page (some r)).allowed = false ∧ outcome (some r) = .denied r := by
  simp [page, outcome, hr]

theorem a_refusal_names_the_set_that_decided (r : Route) (h : r.admits = false) :
    (page (some r)).namedSet = some (.set r.setId) ∧ (page (some r)).allowed = false := by
  simp [page, h]

theorem nothing_routed_names_no_set :
    (page (none : Answer)).namedSet = some .unrouted
      ∧ (page (none : Answer)).allowed = false := by
  simp [page]

theorem every_refusal_has_a_reason (a : Answer) (h : (page a).allowed = false) :
    (page a).namedSet.isSome = true := by
  cases a with
  | none => rfl
  | some r => simp [page] at h ⊢; simp [h]

theorem an_allowance_names_no_set (a : Answer) (h : (page a).allowed = true) :
    (page a).namedSet = none := by
  cases a with
  | none => exact absurd h (by simp [page])
  | some r => simp [page] at h ⊢; simp [h]

theorem a_page_that_reads_something_else_can_disagree :
    ∃ (sets : List Bound), acrossEverySet sets ≠ firstReachable sets :=
  ⟨[⟨true, false⟩, ⟨true, true⟩], by decide⟩


inductive Asked where
  | advertised (answer : Answer)
  | unadvertised

def askedPage : Asked → Page
  | .unadvertised => ⟨false, some .noServerOffers⟩
  | .advertised answer => page answer

def walkWithoutTool : Asked → Answer → Page
  | .unadvertised, without => page without
  | .advertised answer, _ => page answer

theorem the_page_refuses_a_name_nothing_offers :
    (askedPage .unadvertised).allowed = false
      ∧ (askedPage .unadvertised).namedSet = some .noServerOffers := by
  exact ⟨rfl, rfl⟩

theorem the_walk_without_a_tool_admits_for_a_bound_agent :
    (walkWithoutTool .unadvertised (some ⟨"platform", true, none, by simp⟩)).allowed = true := by
  rfl

theorem the_page_refuses_where_the_walk_without_a_tool_admits :
    (askedPage .unadvertised).allowed = false
      ∧ (walkWithoutTool .unadvertised (some ⟨"platform", true, none, by simp⟩)).allowed = true :=
  ⟨rfl, rfl⟩

theorem an_advertised_name_is_answered_by_the_engine (answer : Answer) :
    askedPage (.advertised answer) = page answer := by
  rfl

end AccessPreview
