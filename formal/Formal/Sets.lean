/-
  Which set a call is reached through — `mcp-gateway/src/sets.ts`.

  A call names a set, or names nothing and is answered by the sets its agent is
  bound to. Two rules decide the answer, and both are silent when they go wrong:
  a set an agent is not bound to must not be reachable by naming it, and a set
  that denies a tool must not be talked out of it by its own allow list.

  **Naming a set is not reaching it** —
  `a_reached_set_is_one_the_agent_is_bound_to`, read for the shape a call
  actually has in `naming_a_set_does_not_reach_it_without_a_binding`. The guard is
  one `continue` in the loop; without it naming any set reaches its servers:
  `dropping_the_binding_gate_lets_any_agent_name_any_set`.

  **A deny wins inside its set** —
  `a_denied_tool_is_not_allowed_however_the_allow_list_reads`, and the other side
  of the same rule, `an_allowed_tool_is_one_the_allow_list_names`. Both are about
  one set's own two lists.

  **The first set with a live server decides** —
  `a_reached_set_has_a_live_server` is why a set whose servers are all down
  yields the turn to the next one, which
  `a_set_that_reaches_nothing_yields_to_the_next` shows happening, and
  `a_set_that_denies_decides_over_a_later_one_that_allows` is what that costs: an
  agent bound to two sets is answered by the first of them that reaches a server,
  so a deny in that set hides a grant in the next. That is the file's order read
  literally, and it is the opposite of what a reader who expects any bound set to
  grant would predict — which is why it is proved rather than commented.

  Idealisation: a set is its two lists and the servers it names; being live is a
  predicate on a server id, which is the resolver the file asks. The
  registration-time refusals (`registerServer`, `registerSet`, `bindAgent`: a
  duplicate, an unknown id, an allow-deny overlap) are not modelled — they throw
  where they stand, before any of this runs.
-/

namespace McpGateway

/-- A declared set: the servers it reaches, and what it allows within them. -/
structure McpSet where
  setId : String
  servers : List String
  allowTools : Option (List String)
  denyTools : Option (List String)
deriving DecidableEq, Repr

/-- `allow` minus `deny`: the deny list wins where the two name one tool, and a
set with no allow list allows everything it does not deny. -/
def allows (s : McpSet) (tool : String) : Bool :=
  (match s.allowTools with
   | none => true
   | some allowed => allowed.contains tool) &&
  !(match s.denyTools with
    | none => false
    | some denied => denied.contains tool)

/-- The set a candidate id names, when one does. -/
def setOf (sets : List McpSet) (setId : String) : Option McpSet :=
  sets.find? fun s => s.setId = setId

/-- The first server of the set that is live — the file's `find(Boolean)` over
the resolver. A set whose servers are all down reaches nothing. -/
def liveServer (live : String → Bool) (s : McpSet) : Option String :=
  s.servers.find? fun id => live id

/-- Whether an agent may reach a set: it is bound to it, or the call named no
agent at all. -/
def boundTo (bindings : String → List String) (agent : Option String) (setId : String) : Bool :=
  match agent with
  | none => true
  | some a => (bindings a).contains setId

/-- What a call offers to be reached by, in the order the file reads it: the set
it names, or else the sets its agent is bound to. -/
def candidates (bindings : String → List String) (agent : Option String) (setId : Option String) : List String :=
  match setId with
  | some id => [id]
  | none =>
    match agent with
    | some a => bindings a
    | none => []

/-- The file's loop: the first candidate the agent may reach that names a set
with a live server, and that set's verdict on the tool. -/
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

/-- `resolve`, as the gateway calls it on one request. -/
def resolveSet (live : String → Bool) (sets : List McpSet) (bindings : String → List String)
    (agent : Option String) (setId : Option String) (tool : String) : Option (String × Bool) :=
  reachSet live sets bindings agent tool (candidates bindings agent setId)

/-- The same loop with the binding gate taken out — the control below, and what
"the agent is bound to it" would mean read as a suggestion. -/
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

/-- Whatever the loop answers was offered to it, and the agent may reach it. -/
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

/-- The shape a real call has: one set named, and the agent not bound to it. -/
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

/-- A deny is a deny, whatever the allow list says. -/
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

/-- And the other side of it: a tool an allow list does not name is not allowed
through it, so a set with an allow list reaches only what it wrote down. -/
theorem an_allowed_tool_is_one_the_allow_list_names (s : McpSet) (tool : String) (listed : List String)
    (only : s.allowTools = some listed) (allowed : allows s tool = true) : listed.contains tool = true := by
  simp only [allows, only, Bool.and_eq_true] at allowed
  exact allowed.1

/-- A set is answered for only while it has a live server; once none of its
servers is live the turn passes to the next candidate. -/
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

/-- A call that names no set and carries no agent offers nothing to be reached
by, so it reaches nothing. -/
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

/-- An agent bound to the two sets, and everyone else to neither. -/
def exampleBindings : String → List String :=
  fun agent => if agent = "a1" then ["denying", "allowing"] else []

/-- The control for the gate: an agent bound to nothing reaches the set it names
read without the guard, and nothing read with it. -/
theorem dropping_the_binding_gate_lets_any_agent_name_any_set :
    resolveSetIgnoringBindings liveAll exampleSets exampleBindings (some "other") (some "admin") "read"
        = some ("admin", true) ∧
      resolveSet liveAll exampleSets exampleBindings (some "other") (some "admin") "read" = none := by
  decide

/-- The control for the order: bound to both, answered by the one that denies. -/
theorem a_set_that_denies_decides_over_a_later_one_that_allows :
    resolveSet liveAll exampleSets exampleBindings (some "a1") none "write" = some ("denying", false) ∧
      resolveSet liveAll exampleSets exampleBindings (some "a1") none "read" = some ("denying", true) ∧
      allows allowingSet "write" = true := by
  decide

/-- The control for reachability: the set that denies is skipped once none of its
servers is live, and the one that allows answers — the grant was there all along. -/
theorem a_set_that_reaches_nothing_yields_to_the_next :
    resolveSet (fun id => id = "archives") exampleSets exampleBindings (some "a1") none "write"
        = some ("allowing", true) ∧
      resolveSet liveAll exampleSets exampleBindings (some "a1") none "write" = some ("denying", false) := by
  decide

end McpGateway
