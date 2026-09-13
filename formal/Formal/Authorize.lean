/-
  Which tool a resource key names — `mcp-gateway/src/authorize.ts`, and the
  surface `mcp-gateway/src/mcp-surface.ts` builds from it.

  The gateway speaks in `(serverId, tool)` pairs and the authorization engine
  speaks in resource strings. `mcp://<serverId>/<tool>` is the whole translation,
  and the claim both files make is that the two can never drift apart: a tool
  missing from the listing is a tool the direct call refuses. They cannot drift,
  because the listing is not a second rule that agrees with the call — it is the
  call, asked once per tool, and it keeps the tools that were allowed.

  **The listing is the call** — `a_listed_tool_is_one_the_call_allows`: an entry
  is advertised exactly when the catalog holds it and the engine allowed its key,
  which is the same question `tools/call` asks of the same key. Ask a shallower
  one instead and the listing outruns the call:
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
  is what `authz.visible` and `authz.decide` both already are. The catalog is the
  entries as given, in the order it lists them, so what an entry is keyed by
  downstream (`CatalogEntry.advertised`) is not restated. The shallower
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

/-- `authorizeCall`, for a call that names a tool: the tool's own key, decided. -/
def authorizeCall (decide : Verdict) (ref : ToolRef) : Bool := decide (toolKey ref)

/-- `visibleEntries`: every entry offered to the engine, and kept when the engine
allowed it. One decision each, and no rule besides it. -/
def listedBy (decide : Verdict) (entries : List ToolRef) : List ToolRef :=
  entries.filter fun entry => decide (toolKey entry)

/-- The surface `tools/list` answers with — `mcp-surface.ts`'s `visibleEntries`,
and the empty surface a request that resolved to no principal gets. -/
def surfaceOf (engine : Option Verdict) (entries : List ToolRef) : List ToolRef :=
  match engine with
  | none => []
  | some decide => listedBy decide entries

/-- The call for the same request, refused when there is no principal. -/
def callOf (engine : Option Verdict) (ref : ToolRef) : Bool :=
  match engine with
  | none => false
  | some decide => authorizeCall decide ref

/-- A tool the listing shows is a tool the call allows, and a tool it hides is one
the call refuses — the one decision, kept. -/
theorem a_listed_tool_is_one_the_call_allows (decide : Verdict) (entries : List ToolRef)
    (ref : ToolRef) :
    ref ∈ listedBy decide entries ↔ (ref ∈ entries ∧ authorizeCall decide ref = true) := by
  simp [listedBy, authorizeCall]

/-- What `tools/list` answers with and what `tools/call` decides are one answer:
the listing has no tool the call would refuse. -/
theorem a_tool_missing_from_the_surface_is_a_tool_the_call_refuses (engine : Option Verdict)
    (entries : List ToolRef) (ref : ToolRef) :
    ref ∈ surfaceOf engine entries ↔ (ref ∈ entries ∧ callOf engine ref = true) := by
  cases engine with
  | none => simp [surfaceOf, callOf]
  | some decide => simpa [surfaceOf, callOf] using a_listed_tool_is_one_the_call_allows decide entries ref

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

/-- The control for the key: the listing asked about the server instead of the
tool, which is the shallower question a server grant answers. Two tools of one
server are then advertised together, and the call on the one the grant never
covered is refused — the drift that deciding each entry on its own key avoids. -/
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
