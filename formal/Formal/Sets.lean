namespace McpGateway

structure McpSet where
  setId : String
  servers : List String
  allowTools : Option (List String)
  denyTools : Option (List String)
deriving DecidableEq, Repr

def allows (s : McpSet) (tool : String) : Bool :=
  (match s.allowTools with
   | none => true
   | some allowed => allowed.contains tool) &&
  !(match s.denyTools with
    | none => false
    | some denied => denied.contains tool)

def setOf (sets : List McpSet) (setId : String) : Option McpSet :=
  sets.find? fun s => s.setId = setId

def liveServer (live : String → Bool) (s : McpSet) : Option String :=
  s.servers.find? fun id => live id

def boundTo (bindings : String → List String) (agent : Option String) (setId : String) : Bool :=
  match agent with
  | none => true
  | some a => (bindings a).contains setId

def candidates (bindings : String → List String) (agent : Option String) (setId : Option String) : List String :=
  match setId with
  | some id => [id]
  | none =>
    match agent with
    | some a => bindings a
    | none => []

def reachSet (live : String → Bool) (sets : List McpSet) (bindings : String → List String)
    (agent : Option String) (tool : String) : List String → Option (String × Bool)
  | [] => none
  | id :: rest =>
    if boundTo bindings agent id then
      match setOf sets id with
      | none => reachSet live sets bindings agent tool rest
      | some s =>
        match liveServer live s with
        | none => reachSet live sets bindings agent tool rest
        | some _ => some (id, allows s tool)
    else reachSet live sets bindings agent tool rest

def resolveSet (live : String → Bool) (sets : List McpSet) (bindings : String → List String)
    (agent : Option String) (setId : Option String) (tool : String) : Option (String × Bool) :=
  reachSet live sets bindings agent tool (candidates bindings agent setId)

def reachAnySet (live : String → Bool) (sets : List McpSet) (tool : String) : List String → Option (String × Bool)
  | [] => none
  | id :: rest =>
    match setOf sets id with
    | none => reachAnySet live sets tool rest
    | some s =>
      match liveServer live s with
      | none => reachAnySet live sets tool rest
      | some _ => some (id, allows s tool)

def resolveSetIgnoringBindings (live : String → Bool) (sets : List McpSet)
    (bindings : String → List String) (agent : Option String) (setId : Option String) (tool : String) :
    Option (String × Bool) :=
  reachAnySet live sets tool (candidates bindings agent setId)

theorem a_reached_set_is_one_the_agent_is_bound_to (live : String → Bool) (sets : List McpSet)
    (bindings : String → List String) (agent : Option String) (tool : String) :
    ∀ (offered : List String) (id : String) (ok : Bool),
      reachSet live sets bindings agent tool offered = some (id, ok) →
      id ∈ offered ∧ boundTo bindings agent id = true := by
  intro offered
  induction offered with
  | nil => intro id ok h; simp [reachSet] at h
  | cons head rest ih =>
    intro id ok h
    simp only [reachSet] at h
    split at h
    · rename_i gate
      split at h
      · rename_i missing
        exact ⟨List.mem_cons_of_mem _ (ih id ok h).1, (ih id ok h).2⟩
      · rename_i s found
        split at h
        · rename_i down
          exact ⟨List.mem_cons_of_mem _ (ih id ok h).1, (ih id ok h).2⟩
        · rename_i sid alive
          have same : head = id := congrArg Prod.fst (Option.some.inj h)
          subst same
          exact ⟨List.mem_cons_self, gate⟩
    · rename_i nogate
      exact ⟨List.mem_cons_of_mem _ (ih id ok h).1, (ih id ok h).2⟩

theorem naming_a_set_does_not_reach_it_without_a_binding (live : String → Bool) (sets : List McpSet)
    (bindings : String → List String) (agent setId tool : String)
    (unbound : (bindings agent).contains setId = false) :
    resolveSet live sets bindings (some agent) (some setId) tool = none := by
  simp only [resolveSet, candidates]
  cases reached : reachSet live sets bindings (some agent) tool [setId] with
  | none => rfl
  | some answer =>
    obtain ⟨id, ok⟩ := answer
    have got := a_reached_set_is_one_the_agent_is_bound_to live sets bindings (some agent) tool
      [setId] id ok reached
    have same : id = setId := List.mem_singleton.mp got.1
    have bound : (bindings agent).contains id = true := got.2
    rw [same] at bound
    rw [bound] at unbound
    exact Bool.noConfusion unbound

theorem a_denied_tool_is_not_allowed_however_the_allow_list_reads (s : McpSet) (tool : String)
    (listed : List String) (denied : s.denyTools = some listed) (member : listed.contains tool = true) :
    allows s tool = false := by
  have no : (match s.denyTools with
             | none => false
             | some denied => denied.contains tool) = true := by
    rw [denied]
    exact member
  unfold allows
  rw [no, Bool.not_true]
  exact Bool.and_false _

theorem an_allowed_tool_is_one_the_allow_list_names (s : McpSet) (tool : String) (listed : List String)
    (only : s.allowTools = some listed) (allowed : allows s tool = true) : listed.contains tool = true := by
  simp only [allows, only, Bool.and_eq_true] at allowed
  exact allowed.1

theorem a_reached_set_has_a_live_server (live : String → Bool) (sets : List McpSet)
    (bindings : String → List String) (agent : Option String) (tool : String) :
    ∀ (offered : List String) (id : String) (ok : Bool),
      reachSet live sets bindings agent tool offered = some (id, ok) →
      ∃ s, setOf sets id = some s ∧ liveServer live s ≠ none := by
  intro offered
  induction offered with
  | nil => intro id ok h; simp [reachSet] at h
  | cons head rest ih =>
    intro id ok h
    simp only [reachSet] at h
    split at h
    · rename_i gate
      split at h
      · rename_i missing
        exact ih id ok h
      · rename_i s found
        split at h
        · rename_i down
          exact ih id ok h
        · rename_i sid alive
          have same : head = id := congrArg Prod.fst (Option.some.inj h)
          subst same
          exact ⟨s, found, by simp [alive]⟩
    · rename_i nogate
      exact ih id ok h

theorem a_call_that_names_no_set_and_no_agent_reaches_nothing (live : String → Bool)
    (sets : List McpSet) (bindings : String → List String) (tool : String) :
    resolveSet live sets bindings none none tool = none := by
  simp [resolveSet, candidates, reachSet]

def liveAll : String → Bool := fun _ => true

def denyingSet : McpSet :=
  { setId := "denying", servers := ["files"], allowTools := some ["read", "write"], denyTools := some ["write"] }

def allowingSet : McpSet :=
  { setId := "allowing", servers := ["files", "archives"], allowTools := some ["read", "write"], denyTools := none }

def adminSet : McpSet :=
  { setId := "admin", servers := ["root"], allowTools := none, denyTools := none }

def exampleSets : List McpSet := [adminSet, denyingSet, allowingSet]

def exampleBindings : String → List String :=
  fun agent => if agent = "a1" then ["denying", "allowing"] else []

theorem dropping_the_binding_gate_lets_any_agent_name_any_set :
    resolveSetIgnoringBindings liveAll exampleSets exampleBindings (some "other") (some "admin") "read"
        = some ("admin", true) ∧
      resolveSet liveAll exampleSets exampleBindings (some "other") (some "admin") "read" = none := by
  decide

theorem a_set_that_denies_decides_over_a_later_one_that_allows :
    resolveSet liveAll exampleSets exampleBindings (some "a1") none "write" = some ("denying", false) ∧
      resolveSet liveAll exampleSets exampleBindings (some "a1") none "read" = some ("denying", true) ∧
      allows allowingSet "write" = true := by
  decide

theorem a_set_that_reaches_nothing_yields_to_the_next :
    resolveSet (fun id => id = "archives") exampleSets exampleBindings (some "a1") none "write"
        = some ("allowing", true) ∧
      resolveSet liveAll exampleSets exampleBindings (some "a1") none "write" = some ("denying", false) := by
  decide

end McpGateway
