/-
  The node guard — `packages/agentd/src/control-guard.ts`.

  One credential check in front of every node-facing verb, and its header makes
  a claim about the reader, not the code: "An absent token means the guard is not
  armed, and `tokenRequired` says so out loud rather than leaving a caller to
  infer it from the config."

  That claim is what makes a fail-open guard safe. `authorized` is deliberately
  true whenever nothing is armed — so a caller that consults only `authorized`
  accepts every request on an unarmed node. What keeps that from being a hole is
  that a caller may instead consult `tokenRequired` and skip the check itself;
  the two must therefore be two readings of *one* fact. Derive them from
  different conditions and the two callers reach opposite verdicts, with nothing
  reporting which one was wrong.

  So: `token_required_and_authorized_agree` is the header's claim, and the
  concrete control is that same pair disagreeing the moment the arm condition is
  written twice.

  Idealisation: a token is its characters. Constant-time comparison is a timing
  property, which is not in these semantics — `Formal/README.md`'s rule puts
  that where it belongs, on the code that has to get it right.
-/

namespace Agentd

/-- What is armed: the configured token, or nothing. -/
abbrev Guard := Option String

/-- `tokenRequired` — whether a credential is required at all. -/
def tokenRequired (g : Guard) : Bool := g.isSome

/-- `authorized` — whether a presented token opens the node-facing verbs. -/
def authorized (g : Guard) (presented : Option String) : Bool :=
  match g, presented with
  | none, _ => true
  | some _, none => false
  | some secret, some given => decide (given = secret)

/-- An unarmed guard opens the node to anything. This is the fail-open the header
accounts for, stated so it cannot be read as an accident. -/
theorem an_unarmed_guard_opens_the_node (presented : Option String) :
    authorized none presented = true := by
  simp [authorized]

/-- An armed guard refuses a request that presents no token — the fail-closed
half, and the one that has to hold for the guard to be worth arming. -/
theorem an_armed_guard_refuses_a_request_that_presents_nothing (secret : String) :
    authorized (some secret) none = false := by
  simp [authorized]

/-- An armed guard opens on its own token and on nothing else. -/
theorem an_armed_guard_opens_only_on_its_own_token (secret given : String) :
    authorized (some secret) (some given) = decide (given = secret) := by
  simp [authorized]

/-- The header's claim: `tokenRequired` and `authorized` are two readings of one
fact. A caller that skips the check when nothing is required, and a caller that
lets the check decide, cannot be told different things. -/
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

/-- The arm condition written twice instead of once — the shape this guard avoids.
Here the second copy also treats an empty token as "not configured". -/
def tokenRequiredWrittenTwice (g : Guard) : Bool := g.isSome && g != some ""

/-- The control: at an empty configured token the two readings disagree. The flag
says no credential is required, so a caller that trusts it accepts everything;
the check refuses. One of the two callers is wrong and neither is told. -/
theorem reading_the_arm_condition_twice_lets_the_two_readings_disagree :
    tokenRequiredWrittenTwice (some "") = false ∧ authorized (some "") none = false := by
  decide

end Agentd
