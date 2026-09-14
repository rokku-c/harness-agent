namespace McpGateway

structure ToolRef where
  serverId : String
  tool : String
deriving DecidableEq, Repr

def keyOf (serverId tool : String) : List Char :=
  "mcp://".toList ++ (serverId.toList ++ ['/'] ++ tool.toList)

def toolKey (ref : ToolRef) : List Char := keyOf ref.serverId ref.tool

def serverKey (ref : ToolRef) : List Char := "mcp://".toList ++ ref.serverId.toList

abbrev Verdict := List Char → Bool

def authorizeCall (decide : Verdict) (ref : ToolRef) : Bool := decide (toolKey ref)

def listedBy (decide : Verdict) (entries : List ToolRef) : List ToolRef :=
  entries.filter fun entry => decide (toolKey entry)

def surfaceOf (engine : Option Verdict) (entries : List ToolRef) : List ToolRef :=
  match engine with
  | none => []
  | some decide => listedBy decide entries

def callOf (engine : Option Verdict) (ref : ToolRef) : Bool :=
  match engine with
  | none => false
  | some decide => authorizeCall decide ref

theorem a_listed_tool_is_one_the_call_allows (decide : Verdict) (entries : List ToolRef)
    (ref : ToolRef) :
    ref ∈ listedBy decide entries ↔ (ref ∈ entries ∧ authorizeCall decide ref = true) := by
  simp [listedBy, authorizeCall]

theorem a_tool_missing_from_the_surface_is_a_tool_the_call_refuses (engine : Option Verdict)
    (entries : List ToolRef) (ref : ToolRef) :
    ref ∈ surfaceOf engine entries ↔ (ref ∈ entries ∧ callOf engine ref = true) := by
  cases engine with
  | none => simp [surfaceOf, callOf]
  | some decide => simpa [surfaceOf, callOf] using a_listed_tool_is_one_the_call_allows decide entries ref

theorem a_request_with_no_principal_lists_nothing_and_refuses (entries : List ToolRef)
    (ref : ToolRef) : surfaceOf none entries = [] ∧ callOf none ref = false := ⟨rfl, rfl⟩


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

theorem one_key_names_one_tool (serverId tool serverId' tool' : String)
    (left : '/' ∉ serverId.toList) (left' : '/' ∉ serverId'.toList)
    (same : keyOf serverId tool = keyOf serverId' tool') : serverId = serverId' ∧ tool = tool' := by
  rw [keyOf, keyOf] at same
  have halves := a_separator_separates serverId.toList tool.toList serverId'.toList tool'.toList
    left left' (List.append_cancel_left same)
  exact ⟨String.toList_inj.mp halves.1, String.toList_inj.mp halves.2⟩

def surfaceKeyedByServer (decide : Verdict) (entries : List ToolRef) : List ToolRef :=
  let listed := (entries.map serverKey).filter decide
  entries.filter fun entry => serverKey entry ∈ listed

def boardTools : List ToolRef := [⟨"board", "view"⟩, ⟨"board", "delete"⟩]
def onlyTheServer : Verdict := fun key => key = serverKey ⟨"board", ""⟩

theorem keying_the_listing_by_the_server_lists_a_tool_the_call_refuses :
    (⟨"board", "delete"⟩ : ToolRef) ∈ surfaceKeyedByServer onlyTheServer boardTools ∧
      authorizeCall onlyTheServer ⟨"board", "delete"⟩ = false ∧
      ¬ (⟨"board", "delete"⟩ : ToolRef) ∈ surfaceOf (some onlyTheServer) boardTools := by
  decide

theorem a_name_that_carries_the_separator_gives_two_tools_one_verdict :
    keyOf "board" "tasks/open" = keyOf "board/tasks" "open" ∧
      authorizeCall (fun key => key = keyOf "board/tasks" "open") ⟨"board", "tasks/open"⟩ = true ∧
      (⟨"board", "tasks/open"⟩ : ToolRef) ≠ ⟨"board/tasks", "open"⟩ ∧
      keyOf "board" "tasks" ≠ keyOf "board" "open" := by
  decide

end McpGateway
