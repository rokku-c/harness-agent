namespace AccessReasons

inductive Refusal where
  | deny
  | allowlist
deriving DecidableEq, Repr

structure Lists where
  allow : Option (List String)
  deny : List String

def refuses (lists : Lists) (tool : String) : Option Refusal :=
  match lists.allow with
  | none => if lists.deny.contains tool then some .deny else none
  | some allowed =>
    if lists.deny.contains tool then some .deny
    else if allowed.contains tool then none else some .allowlist

inductive Fact where
  | noServerOffers
  | unboundAgent
  | noReachableSet
  | refusedBySet (setId tool : String)
deriving DecidableEq, Repr

structure Facts where
  unadvertised : Bool
  unbound : Bool
  unrouted : Bool
  setId : String
  tool : String
  unbound_reaches_nothing : unbound = true → unrouted = true

def ladder (facts : Facts) : Fact :=
  if facts.unadvertised then .noServerOffers
  else if facts.unbound then .unboundAgent
  else if facts.unrouted then .noReachableSet
  else .refusedBySet facts.setId facts.tool

def routeFirst (facts : Facts) : Fact :=
  if facts.unrouted then .noReachableSet
  else if facts.unadvertised then .noServerOffers
  else if facts.unbound then .unboundAgent
  else .refusedBySet facts.setId facts.tool

theorem the_catalog_is_read_before_the_bindings (facts : Facts) (h : facts.unadvertised = true) :
    ladder facts = .noServerOffers := by
  simp [ladder, h]

theorem an_unbound_agent_is_never_sent_to_the_registry (facts : Facts) (h : facts.unbound = true) :
    facts.unrouted = true ∧ ladder facts ≠ .noReachableSet := by
  have also : facts.unrouted = true := facts.unbound_reaches_nothing h
  refine ⟨also, ?_⟩
  unfold ladder
  by_cases advertised : facts.unadvertised = true
  · simp [advertised]
  · simp [advertised, h]

theorem reading_the_route_first_blames_the_registry :
    routeFirst ⟨false, true, true, "", "", fun _ => rfl⟩ = .noReachableSet
      ∧ ladder ⟨false, true, true, "", "", fun _ => rfl⟩ = .unboundAgent := by
  constructor <;> simp [routeFirst, ladder]

theorem every_refusal_is_one_of_the_four (facts : Facts) :
    ladder facts = .noServerOffers ∨ ladder facts = .unboundAgent
      ∨ ladder facts = .noReachableSet ∨ ladder facts = .refusedBySet facts.setId facts.tool := by
  by_cases advertised : facts.unadvertised = true
  · exact Or.inl (the_catalog_is_read_before_the_bindings facts advertised)
  · by_cases bound : facts.unbound = true
    · simp [ladder, advertised, bound]
    · by_cases routed : facts.unrouted = true
      · simp [ladder, advertised, bound, routed]
      · simp [ladder, advertised, bound, routed]

theorem the_sentence_names_the_tool_the_list_is_written_in : refuses ⟨some ["read"], ["write"]⟩ "read" = none := by
  decide

theorem a_sentence_in_the_advertised_name_names_another_string :
    refuses ⟨some ["read"], []⟩ "files.read" = some .allowlist
      ∧ refuses ⟨some ["read"], []⟩ "read" = none := by
  decide

end AccessReasons
