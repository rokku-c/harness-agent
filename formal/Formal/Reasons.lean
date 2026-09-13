/-
  WHY THE GATEWAY REFUSED — `apps/mcp-gateway-app/src/access-reasons.ts`.

  The console's one question is answered by one verdict, and a refusal of it is
  explained by one sentence. The file is that sentence's whole rule: four facts
  about four different objects — the catalog the door advertises from, the
  bindings an agent holds, the registry a set's servers are drawn from, and a
  set's own two lists — read in one order, most specific first.

  **The order is the claim** — `the_catalog_is_read_before_the_bindings`. A name
  no server offers is answered first because nothing below it can be about a tool
  that does not exist. An agent bound to nothing is answered next, and
  `an_unbound_agent_is_never_sent_to_the_registry` is why it has to be:
  `unbound_reaches_nothing` is the engine's own fact that a binding is the only
  way to a set, so "no bound set has a reachable server" holds whenever the agent
  is unbound — the same denial, one cause further down. Read the route first and
  the page names the registry for an agent whose problem is its binding:
  `reading_the_route_first_blames_the_registry`.

  **A set's lists are written in the tool's own name** —
  `a_sentence_in_the_advertised_name_names_another_string`. A set groups servers,
  so `read` in its list means read on any of them; the sentence has to name the
  tool as the list it names is written, or an operator edits a list with a string
  it never matches.

  **The four are exhaustive** — `every_refusal_is_one_of_the_four`. The file has
  no branch that leaves a refusal unexplained, which is what lets the page draw
  "Denied" and "why" as one answer rather than two that could come apart.

  Idealisation: the facts are three booleans and the engine's own implication,
  rather than a catalog, a set of bindings and a registry — nothing below the
  verdict is read here. The two lists are their strings; what `sets.ts` does with
  them is `Formal/Sets.lean`'s, and this file restates only the one line the
  sentence depends on.
-/

namespace AccessReasons

/-- Which of a set's two lists refused a tool. -/
inductive Refusal where
  | deny
  | allowlist
deriving DecidableEq, Repr

/-- One set's two lists, as `sets.ts` reads them. -/
structure Lists where
  allow : Option (List String)
  deny : List String

/-- Which of the two refuses a tool — `sets.ts`'s `refusedBy`, deny first. -/
def refuses (lists : Lists) (tool : String) : Option Refusal :=
  match lists.allow with
  | none => if lists.deny.contains tool then some .deny else none
  | some allowed =>
    if lists.deny.contains tool then some .deny
    else if allowed.contains tool then none else some .allowlist

/-- The four facts a refusal can be about, and the four sentences the page has. -/
inductive Fact where
  | noServerOffers
  | unboundAgent
  | noReachableSet
  | refusedBySet (setId tool : String)
deriving DecidableEq, Repr

/--
What is true of the request being explained. `unbound` and `unrouted` are not two
explanations of one denial: a binding is the only way to a set, so an agent bound
to nothing has no bound set that reaches a server — the second holds whenever the
first does, which is what makes the first the more specific of the two.
-/
structure Facts where
  unadvertised : Bool
  unbound : Bool
  unrouted : Bool
  /-- the set the engine routed to, and the tool as that set's lists write it -/
  setId : String
  tool : String
  unbound_reaches_nothing : unbound = true → unrouted = true

/-- The file's ladder, in its order: the most specific fact that holds. -/
def ladder (facts : Facts) : Fact :=
  if facts.unadvertised then .noServerOffers
  else if facts.unbound then .unboundAgent
  else if facts.unrouted then .noReachableSet
  else .refusedBySet facts.setId facts.tool

/-- The same four facts read from the route: what a page that asked the registry
    question first would print. -/
def routeFirst (facts : Facts) : Fact :=
  if facts.unrouted then .noReachableSet
  else if facts.unadvertised then .noServerOffers
  else if facts.unbound then .unboundAgent
  else .refusedBySet facts.setId facts.tool

/-- A name no server offers is answered first: no fact below it can be about a
tool that does not exist. -/
theorem the_catalog_is_read_before_the_bindings (facts : Facts) (h : facts.unadvertised = true) :
    ladder facts = .noServerOffers := by
  simp [ladder, h]

/-- An unbound agent is named as one: the route also reaches nothing, so the page
has a second true sentence it could print — and it prints the one that is about
the binding, never sending the operator to the registry for a server that was
never what refused the call. -/
theorem an_unbound_agent_is_never_sent_to_the_registry (facts : Facts) (h : facts.unbound = true) :
    facts.unrouted = true ∧ ladder facts ≠ .noReachableSet := by
  have also : facts.unrouted = true := facts.unbound_reaches_nothing h
  refine ⟨also, ?_⟩
  unfold ladder
  by_cases advertised : facts.unadvertised = true
  · simp [advertised]
  · simp [advertised, h]

/-- The control: reading the route first does exactly that, for an agent whose
only problem is that it holds no binding. -/
theorem reading_the_route_first_blames_the_registry :
    routeFirst ⟨false, true, true, "", "", fun _ => rfl⟩ = .noReachableSet
      ∧ ladder ⟨false, true, true, "", "", fun _ => rfl⟩ = .unboundAgent := by
  constructor <;> simp [routeFirst, ladder]

/-- No refusal is left unexplained: the four sentences are the whole of what the
page can say, so "Denied" and "why" cannot come apart. -/
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

/-- The list the sentence names is the list the engine compared against: a set's
lists are written in the tool's own name, and the sentence quotes that name. -/
theorem the_sentence_names_the_tool_the_list_is_written_in : refuses ⟨some ["read"], ["write"]⟩ "read" = none := by
  decide

/-- The control: a sentence quoting the advertised name instead names a string the
list is never compared against — the operator adds it and nothing changes. -/
theorem a_sentence_in_the_advertised_name_names_another_string :
    refuses ⟨some ["read"], []⟩ "files.read" = some .allowlist
      ∧ refuses ⟨some ["read"], []⟩ "read" = none := by
  decide

end AccessReasons
