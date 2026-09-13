/-
  Which tool a resource key names — `mcp-gateway/src/authorize.ts`, and the
  surface `mcp-gateway/src/mcp-surface.ts` builds from it.

  The gateway speaks in `(serverId, tool)` pairs and the authorization engine
  speaks in resource strings. `mcp://<serverId>/<tool>` is the whole translation,
  and the claim both files make is that the two can never drift apart: a tool
  missing from the listing is a tool the direct call refuses. Listing and calling
  do go through one engine — but the listing's test is not the decision, it is
  *membership in a set of resource strings*, and the surface makes that round trip
  twice. That is what this proves about.

  **The listing is the call** — `a_listed_tool_is_one_the_call_allows`. The key
  the set is built from is the key the call is decided on, so the round trip
  cannot change the answer; the surface's second round trip
  (`a_tool_missing_from_the_surface_is_a_tool_the_call_refuses`) is the same
  fact one layer out. Key the listing by anything else and it outruns the call:
  `keying_the_listing_by_the_server_lists_a_tool_the_call_refuses`.

  **One key is one tool** — `one_key_names_one_tool`, from
  `a_separator_separates`: with no `/` in a name, the separator is the split, so
  `mcp://<serverId>/<tool>` determines the pair and a grant for one tool is not a
  grant for another. `effect-authz/src/resource.ts` states the constraint "by
  convention, not enforced here", and this is what it buys. A name that carries
  the separator gives two tools one verdict —
  `a_name_that_carries_the_separator_gives_two_tools_one_verdict` — which is a
  grant silently widened to a tool it was never written for.

  **A request with no principal** —
  `a_request_with_no_principal_lists_nothing_and_refuses`: the surface is empty,
  because `tools/list` has no channel for a refusal, and the call answers in full.
  Neither consults the engine, so neither can disagree about a principal that is
  not there.

  Idealisation: a resource is its characters, which makes the key round trip the
  thing under proof rather than an assumed string equality, and a principal is
  folded into the engine — the engine as one request's principal sees it, which
  is what `authz.visible` and `authz.decide` both already are. The shallower
  `mcp://<serverId>` a tool-less call addresses is `Formal/Match.lean`'s rule, and
  resolving a token to a principal is `Formal/Resolve.lean`'s, so neither is
  restated here. The audit events `decide.ts` records are not modelled: nothing
  reads them back.
-/

namespace McpGateway

/-- A tool reference: the pair the gateway speaks in. -/
structure ToolRef where
  serverId : String
  tool : String
deriving DecidableEq, Repr

/-- The characters of the resource a pair addresses — `serverToolResource`. -/
def keyOf (serverId tool : String) : List Char :=
  "mcp://".toList ++ (serverId.toList ++ ['/'] ++ tool.toList)

/-- The key a tool ref addresses. -/
def toolKey (ref : ToolRef) : List Char := keyOf ref.serverId ref.tool

/-- The shallower key a tool-less call addresses — `serverResource`. -/
def serverKey (ref : ToolRef) : List Char := "mcp://".toList ++ ref.serverId.toList

/-- The engine's verdict on a key, for the principal one request carries. -/
abbrev Verdict := List Char → Bool

/-- `authz.visible`, as the keys it answered with. -/
def grantedKeys (decide : Verdict) (refs : List ToolRef) : List (List Char) :=
  (refs.map toolKey).filter decide

/-- `visibleToolRefs`: the engine's answer collected into a set of keys, then the
refs whose own key is in it. -/
def visibleToolRefs (decide : Verdict) (refs : List ToolRef) : List ToolRef :=
  refs.filter fun ref => toolKey ref ∈ grantedKeys decide refs

/-- `authorizeCall`, for a call that names a tool: the same key, decided. -/
def authorizeCall (decide : Verdict) (ref : ToolRef) : Bool := decide (toolKey ref)

/-- The surface `tools/list` answers with — `mcp-surface.ts`'s `project`, both
round trips through the key as written, and the empty surface a request that
resolved to no principal gets. -/
def surfaceOf (engine : Option Verdict) (entries : List ToolRef) : List ToolRef :=
  match engine with
  | none => []
  | some decide =>
    let listed := (visibleToolRefs decide entries).map toolKey
    entries.filter fun entry => toolKey entry ∈ listed

/-- The call for the same request, refused when there is no principal. -/
def callOf (engine : Option Verdict) (ref : ToolRef) : Bool :=
  match engine with
  | none => false
  | some decide => authorizeCall decide ref

/-- A key the engine granted is the key the call asks about — the same key, so
the set and the call cannot answer differently. -/
theorem a_key_the_engine_granted_is_the_key_the_call_asks_about (decide : Verdict)
    (refs : List ToolRef) (ref : ToolRef) (below : ref ∈ refs) :
    toolKey ref ∈ grantedKeys decide refs ↔ authorizeCall decide ref = true := by
  rw [grantedKeys, List.mem_filter, authorizeCall]
  constructor
  · intro held
    exact held.2
  · intro allowed
    exact ⟨List.mem_map.mpr ⟨ref, below, rfl⟩, allowed⟩

/-- A tool the listing shows is a tool the call allows, and a tool it hides is one
the call refuses. -/
theorem a_listed_tool_is_one_the_call_allows (decide : Verdict) (refs : List ToolRef)
    (ref : ToolRef) :
    ref ∈ visibleToolRefs decide refs ↔ (ref ∈ refs ∧ authorizeCall decide ref = true) := by
  rw [visibleToolRefs, List.mem_filter]
  constructor
  · intro held
    exact ⟨held.1,
      (a_key_the_engine_granted_is_the_key_the_call_asks_about decide refs ref held.1).mp
        (decide_eq_true_iff.mp held.2)⟩
  · intro held
    exact ⟨held.1, decide_eq_true_iff.mpr
      ((a_key_the_engine_granted_is_the_key_the_call_asks_about decide refs ref held.1).mpr held.2)⟩

/-- The surface's own round trip: the key it lists a ref under is the key the call
is decided on, whichever ref put that key in the set. -/
theorem a_key_the_surface_lists_is_the_key_the_call_asks_about (decide : Verdict)
    (refs : List ToolRef) (ref : ToolRef) (below : ref ∈ refs) :
    toolKey ref ∈ (visibleToolRefs decide refs).map toolKey ↔ authorizeCall decide ref = true := by
  constructor
  · intro held
    obtain ⟨other, shown, same⟩ := List.mem_map.mp held
    have allowed := (a_listed_tool_is_one_the_call_allows decide refs other).mp shown
    rw [authorizeCall, ← same]
    exact allowed.2
  · intro allowed
    exact List.mem_map.mpr ⟨ref, (a_listed_tool_is_one_the_call_allows decide refs ref).mpr
      ⟨below, allowed⟩, rfl⟩

/-- What `tools/list` answers with and what `tools/call` decides are one answer:
the listing has no tool the call would refuse. -/
theorem a_tool_missing_from_the_surface_is_a_tool_the_call_refuses (engine : Option Verdict)
    (entries : List ToolRef) (ref : ToolRef) :
    ref ∈ surfaceOf engine entries ↔ (ref ∈ entries ∧ callOf engine ref = true) := by
  cases engine with
  | none => simp [surfaceOf, callOf]
  | some decide =>
    rw [surfaceOf, callOf, List.mem_filter]
    constructor
    · intro held
      exact ⟨held.1,
        (a_key_the_surface_lists_is_the_key_the_call_asks_about decide entries ref held.1).mp
          (decide_eq_true_iff.mp held.2)⟩
    · intro held
      exact ⟨held.1, decide_eq_true_iff.mpr
        ((a_key_the_surface_lists_is_the_key_the_call_asks_about decide entries ref held.1).mpr
          held.2)⟩

/-- A request that resolved to no principal: an empty listing, because
`tools/list` has no channel for a refusal, and a refusal in full from the call.
Neither asks the engine, so the two cannot disagree about it. -/
theorem a_request_with_no_principal_lists_nothing_and_refuses (entries : List ToolRef)
    (ref : ToolRef) : surfaceOf none entries = [] ∧ callOf none ref = false := ⟨rfl, rfl⟩

/-! ### One key is one tool -/

/-- The separator splits. A `/` inside a name is what would make one key two
pairs, so with none on either left half the joined list is the pair. -/
theorem a_separator_separates : ∀ (left right left' right' : List Char),
    '/' ∉ left → '/' ∉ left' →
    left ++ ['/'] ++ right = left' ++ ['/'] ++ right' → left = left' ∧ right = right' := by
  intro left
  induction left with
  | nil =>
    intro right left' right'
    cases left' with
    | nil =>
      intro _ _ same
      simp only [List.nil_append, List.cons_append] at same
      exact ⟨rfl, (List.cons.inj same).2⟩
    | cons c cs =>
      intro _ blocked same
      simp only [List.nil_append, List.cons_append] at same
      have wrong : c = '/' := (List.cons.inj same).1.symm
      exact absurd (by rw [← wrong]; exact List.mem_cons_self) blocked
  | cons d ds ih =>
    intro right left'
    cases left' with
    | nil =>
      intro right' carries _ same
      simp only [List.nil_append, List.cons_append] at same
      have wrong : d = '/' := (List.cons.inj same).1
      exact absurd (by rw [← wrong]; exact List.mem_cons_self) carries
    | cons c cs =>
      intro right' carries blocked same
      simp only [List.cons_append] at same
      have parts := List.cons.inj same
      have split := ih right cs right'
        (fun inside => carries (List.mem_cons_of_mem _ inside))
        (fun inside => blocked (List.mem_cons_of_mem _ inside)) parts.2
      exact ⟨by rw [parts.1, split.1], split.2⟩

/-- Neither the prefix nor the tool name is constrained: the separator sits to the
left of the tool name, so a serverId without one already fixes both halves. -/
theorem one_key_names_one_tool (serverId tool serverId' tool' : String)
    (left : '/' ∉ serverId.toList) (left' : '/' ∉ serverId'.toList)
    (same : keyOf serverId tool = keyOf serverId' tool') : serverId = serverId' ∧ tool = tool' := by
  rw [keyOf, keyOf] at same
  have halves := a_separator_separates serverId.toList tool.toList serverId'.toList tool'.toList
    left left' (List.append_cancel_left same)
  exact ⟨String.toList_inj.mp halves.1, String.toList_inj.mp halves.2⟩

/-- The control for the key: a tool the listing shows by the server's grant, and
the call on that same tool. Keyed by the server instead of the tool, the listing
advertises a tool the call refuses — the drift `mcp-surface.ts` keys the tool to
avoid. -/
def surfaceKeyedByServer (decide : Verdict) (entries : List ToolRef) : List ToolRef :=
  let listed := (entries.map serverKey).filter decide
  entries.filter fun entry => serverKey entry ∈ listed

/-- Two tools of one server, and an engine that grants the server and nothing
else. -/
def boardTools : List ToolRef := [⟨"board", "view"⟩, ⟨"board", "delete"⟩]
def onlyTheServer : Verdict := fun key => key = serverKey ⟨"board", ""⟩

theorem keying_the_listing_by_the_server_lists_a_tool_the_call_refuses :
    (⟨"board", "delete"⟩ : ToolRef) ∈ surfaceKeyedByServer onlyTheServer boardTools ∧
      authorizeCall onlyTheServer ⟨"board", "delete"⟩ = false ∧
      ¬ (⟨"board", "delete"⟩ : ToolRef) ∈ surfaceOf (some onlyTheServer) boardTools := by
  decide

/-- The control for the name: with the separator inside a name, two different
tools make one key and take one verdict, so a grant written for one is a grant
for the other. The third conjunct is the key doing its job on names that obey
the convention. -/
theorem a_name_that_carries_the_separator_gives_two_tools_one_verdict :
    keyOf "board" "tasks/open" = keyOf "board/tasks" "open" ∧
      authorizeCall (fun key => key = keyOf "board/tasks" "open") ⟨"board", "tasks/open"⟩ = true ∧
      (⟨"board", "tasks/open"⟩ : ToolRef) ≠ ⟨"board/tasks", "open"⟩ ∧
      keyOf "board" "tasks" ≠ keyOf "board" "open" := by
  decide

end McpGateway
