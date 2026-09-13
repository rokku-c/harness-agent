/-
  WHAT A LAUNCH IS ARMED WITH — `packages/agentd/src/launch-types.ts` (the union
  the queue holds), `apps/agentd/src/ops/launch-ops.ts` (which fills it),
  `packages/agentd-probe/src/launch-order.ts` (which fetches for it),
  `packages/agentd-probe/src/launch-cycle.ts` (which starts it), and
  `packages/agentdeck/src/adapters/cli-preset.ts` (which renders it).

  A launch is one of two things, and the difference is *who the machine is* when
  it runs. A turn runs as an identity — naming the machine, the dialect to spawn
  and the credential the door will verify — and a command runs as itself and has
  no identity at all. The tempting shape is one intent with the identity as one
  field beside the machine and the dialect: `any_routing_can_be_supplied` is that
  shape, and it says every combination is a request somebody can make, so naming
  an identity constrains nothing and the config the center planned and the
  process that started agree only by luck. Reading the machine and the dialect
  out of the fleet record for the request's own identity is what makes them a
  function of one thing — that is `one_identity_queues_for_one_machine` — and a
  request naming an identity the center holds no record of queues nothing at all.

  The second half is what the process starts *with*. A turn fetches its config
  for its own identity, and the fetch is what decides whether it starts: a
  refusal means that turn cannot reach the platform's tools, so it is settled
  `failed` with the reason rather than started and left to discover the refusal
  one call at a time — an agent whose every call is turned away reports a
  permission problem, which is not what it has, and the operator reads a lie
  about the wrong layer. Two facts make that safe, and both are proved here: a
  started turn carries the credential the center holds under the same key that
  named it (`a_turn_starts_with_the_credential_the_center_holds_for_it`), and no
  other identity's credential is ever consulted in its place
  (`another_identity_s_credential_is_never_substituted`) — so a credentialless
  identity starts nothing rather than being served a neighbour's.

  The third piece is the dialect, and it is the same rule one layer down. Told a
  set of servers it cannot pass on, a dialect must refuse rather than start with
  them dropped, or the advertised set and the enforced set are two sets (F8).
  `delivered` has three values and none of them means "asked for, and delivered
  less"; the last theorems say so and say which dialects can be told at all.

  One label sits beside all of this and decides none of it: the task the work is
  filed under. It is the one thing a caller names that the center does not
  derive, and it is optional — `one_identity_queues_for_one_machine` covers it
  with the rest of what two requests may differ in, and
  `a_queued_turn_carries_the_label_it_was_asked_under` is the other half: the
  queue files work under what was asked and invents no task for work that named
  none, so a turn asked for by hand is filed under nothing rather than
  attributed to a task its caller never named.

  Modelling note: the encodings are the files' own — a queued turn carries the
  machine and the dialect it was resolved to, and both reads are keyed by the
  identity and by nothing else. What is idealised is the wire: an intent here is
  what the queue holds, not the JSON it becomes.
-/

namespace Arming

/-- An identity the center holds: which machine runs it, and which dialect it is
    spawned as. One record answers both, and that is the point of this half. -/
structure Agent where
  machine : Nat
  kind : Nat

/-- The fleet, by identity. `none` = the center holds no record of it. -/
abbrev Fleet := Nat → Option Agent

/-- What `agentd_launch` was asked. There is no machine here and no dialect: a
    caller names the identity and nothing derived from it. The task node is the
    one thing a caller names that the center does not derive, and `none` is a
    turn filed under nothing — asked for by hand, not one whose task is unknown. -/
structure Request where
  agent : Nat
  workdir : Nat
  prompt : Nat
  task : Option Nat

/-- A turn as the queue holds it — the request's identity, and what the fleet
    resolved that identity to, beside the label the request was filed under. -/
structure Turn where
  agent : Nat
  machine : Nat
  kind : Nat
  workdir : Nat
  prompt : Nat
  task : Option Nat

/-- Work with no identity behind it: its own words, run as itself. -/
structure Command where
  machine : Nat
  workdir : Nat
  words : Nat

/-- One intent. The union is the wire's own, not a modelling convenience. -/
inductive Intent where
  | turn : Turn → Intent
  | command : Command → Intent

/-- What the center queues for a request: the identity, and the fleet's record of
    it. The machine and the dialect are read here and are not request fields. -/
def turnOf (fleet : Fleet) (r : Request) : Option Turn :=
  (fleet r.agent).map fun a => ⟨r.agent, a.machine, a.kind, r.workdir, r.prompt, r.task⟩

def queued (fleet : Fleet) (r : Request) : Option Intent :=
  (turnOf fleet r).map Intent.turn

/-- A queued turn's machine comes from the fleet record under its own identity,
    and from nothing else. -/
theorem the_machine_is_a_function_of_the_identity {fleet : Fleet} {r : Request} {t : Turn}
    (h : turnOf fleet r = some t) : ∃ a, fleet r.agent = some a ∧ t.machine = a.machine := by
  cases hf : fleet r.agent with
  | none => simp [turnOf, hf] at h
  | some a => exact ⟨a, rfl, by simp [turnOf, hf] at h; rw [← h]⟩

/-- And what is queued was read from that record: the machine and the dialect of a
    queued turn are the fleet's, which is why a caller naming only an identity
    cannot choose either. -/
theorem a_queued_turn_is_routed_by_its_own_record {fleet : Fleet} {r : Request} {t : Turn} {a : Agent}
    (h : turnOf fleet r = some t) (ha : fleet r.agent = some a) :
    t.machine = a.machine ∧ t.kind = a.kind := by
  simp [turnOf, ha] at h
  subst h
  exact ⟨rfl, rfl⟩

/-- The label is carried, not derived, and nothing is invented for work that
    named none: a turn asked for by hand is filed under nothing rather than
    attributed to a task its caller never named. -/
theorem a_queued_turn_carries_the_label_it_was_asked_under {fleet : Fleet} {r : Request} {t : Turn}
    (h : turnOf fleet r = some t) : t.task = r.task := by
  cases hf : fleet r.agent with
  | none => simp [turnOf, hf] at h
  | some a => simp [turnOf, hf] at h; subst h; rfl

/-- Routing is a function of the identity alone: two requests naming one identity
    queue for one machine under one dialect, whatever else — the working
    directory, the prompt, and the task they are filed under — they differ in. A
    caller therefore cannot send an identity's work to a machine of its choosing,
    and a label is not a lever on that either. -/
theorem one_identity_queues_for_one_machine {fleet : Fleet} {r₁ r₂ : Request} {t₁ t₂ : Turn}
    (h₁ : turnOf fleet r₁ = some t₁) (h₂ : turnOf fleet r₂ = some t₂) (ha : r₁.agent = r₂.agent) :
    t₁.machine = t₂.machine ∧ t₁.kind = t₂.kind := by
  obtain ⟨a₁, hf₁, _⟩ := the_machine_is_a_function_of_the_identity h₁
  obtain ⟨hm₁, hk₁⟩ := a_queued_turn_is_routed_by_its_own_record h₁ hf₁
  obtain ⟨a₂, hf₂, _⟩ := the_machine_is_a_function_of_the_identity h₂
  obtain ⟨hm₂, hk₂⟩ := a_queued_turn_is_routed_by_its_own_record h₂ hf₂
  rw [← ha, hf₁] at hf₂
  have he : a₁ = a₂ := Option.some.inj hf₂
  rw [he] at hm₁ hk₁
  exact ⟨by rw [hm₁, hm₂], by rw [hk₁, hk₂]⟩

/-- An identity the fleet does not hold queues nothing. There is no intent for a
    machine to claim and no dialect to spawn, so the refusal is the absence of
    work rather than work that fails later on an unfamiliar machine. -/
theorem an_identity_the_fleet_does_not_hold_queues_nothing {fleet : Fleet} {r : Request}
    (h : fleet r.agent = none) : queued fleet r = none := by
  simp [queued, turnOf, h]

/-- The tempting shape, for contrast: a request carrying the machine and the
    dialect, with the identity as one more field beside them. Every combination
    is then a request somebody can make — naming an identity constrains nothing
    about where it runs or what it is spawned as. -/
structure Supplied where
  agent : Nat
  machine : Nat
  kind : Nat

theorem any_routing_can_be_supplied (a m k : Nat) :
    ∃ s : Supplied, s.agent = a ∧ s.machine = m ∧ s.kind = k :=
  ⟨⟨a, m, k⟩, rfl, rfl, rfl⟩

/-- What a machine hands the runner. A turn carries the identity it runs as and
    the credential its config carried; a command carries neither. -/
structure Order where
  agent : Option Nat
  credential : Option Nat
  deriving DecidableEq

/-- The config one identity's turn must start with, as the center holds it.
    `none` = no credential was issued for that identity, or the center does not
    know where its door is — either way, a turn that cannot reach the tools. -/
abbrev Armed := Nat → Option Nat

/-- One intent, resolved: a command is what it is, and a turn is fetched for its
    own identity and comes back armed or not at all. -/
def orderOf (armed : Armed) : Intent → Option Order
  | .command _ => some ⟨none, none⟩
  | .turn t => (armed t.agent).map fun c => ⟨some t.agent, some c⟩

/-- What the center is told about one intent, and — when it reached the runner at
    all — the order it was handed. The second component is what makes "it never
    started" checkable rather than inferred from the state. -/
inductive Reported where
  | running
  | failed
  deriving DecidableEq

def beat (armed : Armed) (i : Intent) : Reported × Option Order :=
  match orderOf armed i with
  | none => (.failed, none)
  | some o => (.running, some o)

/-- A refused fetch starts nothing: the machine reports `failed` and hands the
    runner no order, so there is no process that was told the tools exist. -/
theorem a_refused_fetch_starts_nothing {armed : Armed} {t : Turn} (h : armed t.agent = none) :
    beat armed (.turn t) = (.failed, none) := by
  simp [beat, orderOf, h]

/-- Which is to say: nothing starts unarmed. Whatever reached the runner, its
    identity had a credential — the fetch is not a step beside the start, it is
    what the start is conditional on. -/
theorem nothing_starts_unarmed {armed : Armed} {t : Turn} {o : Order}
    (h : beat armed (.turn t) = (.running, some o)) : ∃ c, armed t.agent = some c := by
  cases hf : armed t.agent with
  | none => simp [beat, orderOf, hf] at h
  | some c => exact ⟨c, rfl⟩

/-- And what it carries is the center's entry under the identity that named it:
    the identity and the credential are one lookup's two halves, so there is no
    path on which a turn runs as one identity holding another's credential. -/
theorem a_turn_starts_with_the_credential_the_center_holds_for_it {armed : Armed} {t : Turn} {o : Order}
    (h : beat armed (.turn t) = (.running, some o)) :
    o.agent = some t.agent ∧ o.credential = armed t.agent := by
  cases hf : armed t.agent with
  | none => simp [beat, orderOf, hf] at h
  | some c => simp [beat, orderOf, hf] at h; subst h; exact ⟨rfl, rfl⟩

/-- The converse, which is what keeps the rule from being a refusal of everything:
    an identity the center holds a credential for does start. -/
theorem a_credentialed_turn_does_start {armed : Armed} {t : Turn} {c : Nat} (h : armed t.agent = some c) :
    (beat armed (.turn t)).1 = Reported.running ∧ (beat armed (.turn t)).2 ≠ none := by
  simp [beat, orderOf, h]

/-- And there is no fallback to a neighbour: changing what some other identity is
    armed with does not change what this turn starts with, so a credentialless
    identity is refused rather than served somebody else's. -/
theorem another_identity_s_credential_is_never_substituted (armed : Armed) (t : Turn) (other c : Nat)
    (hne : other ≠ t.agent) :
    orderOf (fun a => if a = other then some c else armed a) (.turn t) = orderOf armed (.turn t) := by
  have h : ¬ (t.agent = other) := fun he => hne he.symm
  simp [orderOf, h]

/-- A command is handed no credential, because there is no identity behind it to
    have been issued one. -/
theorem a_command_is_handed_no_credential {armed : Armed} {c : Command} {o : Order}
    (h : beat armed (.command c) = (.running, some o)) : o.credential = none := by
  simp [beat, orderOf] at h
  subst h
  rfl

/-- Which is also to say a command is untouched by the fleet: who holds what is
    not a question a command's start asks. -/
theorem a_command_is_untouched_by_the_fleet (armed₁ armed₂ : Armed) (c : Command) :
    beat armed₁ (.command c) = beat armed₂ (.command c) := by
  simp [beat, orderOf]

/-- The control, on one armed identity and one bare one claimed in the same beat:
    the refusal is one intent's and not the beat's, so a machine whose fleet holds
    one credential still runs the work it can. -/
def armedTurn : Turn := ⟨1, 0, 0, 0, 0, none⟩

def bareTurn : Turn := ⟨2, 0, 0, 0, 0, some 9⟩

def halfArmed : Armed := fun a => if a = 1 then some 7 else none

theorem one_agent_without_a_credential_does_not_stop_the_beat :
    (beat halfArmed (.turn armedTurn)).1 = Reported.running ∧
    (beat halfArmed (.turn bareTurn)).1 = Reported.failed ∧
    (beat halfArmed (.turn bareTurn)).2 = none := by
  decide

theorem a_credentialed_turn_does_start_on_a_half_armed_fleet :
    (beat halfArmed (.turn armedTurn)).2.isSome = true := by
  decide

/-- Which dialect a launch asks for. -/
inductive Dialect where
  | claude
  | codex
  | gemini
  | pi
  | custom
  deriving DecidableEq

/-- Whether this dialect can be told where the door is at all. `custom` is either
    the bare `agent` binary or a caller's own argv, and neither has a place for a
    dialect's words — one answer covers both because it is one fact. -/
def canBeTold : Dialect → Bool
  | .claude => true
  | .codex => true
  | .gemini => false
  | .pi => false
  | .custom => false

/-- The table the refusal rests on, stated rather than assumed: a dialect added
    here without a delivery written for it is the case that would otherwise start
    an agent with its servers dropped. -/
theorem only_the_two_dialects_that_have_a_route_can_be_told :
    canBeTold .claude = true ∧ canBeTold .codex = true ∧
    canBeTold .gemini = false ∧ canBeTold .pi = false ∧ canBeTold .custom = false := by
  simp [canBeTold]

/-- What telling a dialect costs. `some true` = the servers went; `some false` =
    nothing was asked for; `none` = the launch is refused. -/
def delivered (told asked : Bool) : Option Bool :=
  if asked then (if told then some true else none) else some false

/-- A dialect with no route and a launch that needs the door: refused, and not
    started with the servers quietly missing. -/
theorem a_dialect_that_cannot_be_told_is_refused_rather_than_dropped :
    delivered false true = none := rfl

/-- The happy path, so the refusal above is not vacuous. -/
theorem what_was_asked_for_is_what_is_delivered : delivered true true = some true := rfl

/-- And there is no fourth answer. `some false` means nothing was asked for and
    can mean nothing else, which is what "the advertised set is the enforced set"
    comes to here: a launch that asked for the door either has it or did not
    start. -/
theorem the_only_way_to_deliver_nothing_is_to_have_asked_for_nothing {told asked : Bool}
    (h : delivered told asked = some false) : asked = false := by
  cases asked <;> cases told <;> simp [delivered] at h ⊢

end Arming
