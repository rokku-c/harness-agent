namespace Agentd

abbrev Guard := Option String

def tokenRequired (g : Guard) : Bool := g.isSome

def authorized (g : Guard) (presented : Option String) : Bool :=
  match g, presented with
  | none, _ => true
  | some _, none => false
  | some secret, some given => decide (given = secret)

theorem an_unarmed_guard_opens_the_node (presented : Option String) :
    authorized none presented = true := by
  simp [authorized]

theorem an_armed_guard_refuses_a_request_that_presents_nothing (secret : String) :
    authorized (some secret) none = false := by
  simp [authorized]

theorem an_armed_guard_opens_only_on_its_own_token (secret given : String) :
    authorized (some secret) (some given) = decide (given = secret) := by
  simp [authorized]

theorem token_required_and_authorized_agree (g : Guard) :
    (tokenRequired g = false ↔ ∀ presented, authorized g presented = true) ∧
    (tokenRequired g = true ↔ authorized g none = false) := by
  cases g with
  | none => simp [tokenRequired, authorized]
  | some secret =>
    refine ⟨⟨?_, ?_⟩, ?_⟩
    · intro impossible
      simp [tokenRequired] at impossible
    · intro every
      exact absurd (every none) (by simp [authorized])
    · simp [tokenRequired, authorized]

def tokenRequiredWrittenTwice (g : Guard) : Bool := g.isSome && g != some ""

theorem reading_the_arm_condition_twice_lets_the_two_readings_disagree :
    tokenRequiredWrittenTwice (some "") = false ∧ authorized (some "") none = false := by
  decide

end Agentd
