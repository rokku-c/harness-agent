namespace Arming

structure Agent where
  machine : Nat
  kind : Nat

abbrev Fleet := Nat → Option Agent

structure Request where
  agent : Nat
  workdir : Nat
  prompt : Nat
  task : Option Nat

structure Turn where
  agent : Nat
  machine : Nat
  kind : Nat
  workdir : Nat
  prompt : Nat
  task : Option Nat

structure Command where
  machine : Nat
  workdir : Nat
  words : Nat

inductive Intent where
  | turn : Turn → Intent
  | command : Command → Intent

def turnOf (fleet : Fleet) (r : Request) : Option Turn :=
  (fleet r.agent).map fun a => ⟨r.agent, a.machine, a.kind, r.workdir, r.prompt, r.task⟩

def queued (fleet : Fleet) (r : Request) : Option Intent :=
  (turnOf fleet r).map Intent.turn

theorem the_machine_is_a_function_of_the_identity {fleet : Fleet} {r : Request} {t : Turn}
    (h : turnOf fleet r = some t) : ∃ a, fleet r.agent = some a ∧ t.machine = a.machine := by
  cases hf : fleet r.agent with
  | none => simp [turnOf, hf] at h
  | some a => exact ⟨a, rfl, by simp [turnOf, hf] at h; rw [← h]⟩

theorem a_queued_turn_is_routed_by_its_own_record {fleet : Fleet} {r : Request} {t : Turn} {a : Agent}
    (h : turnOf fleet r = some t) (ha : fleet r.agent = some a) :
    t.machine = a.machine ∧ t.kind = a.kind := by
  simp [turnOf, ha] at h
  subst h
  exact ⟨rfl, rfl⟩

theorem a_queued_turn_carries_the_label_it_was_asked_under {fleet : Fleet} {r : Request} {t : Turn}
    (h : turnOf fleet r = some t) : t.task = r.task := by
  cases hf : fleet r.agent with
  | none => simp [turnOf, hf] at h
  | some a => simp [turnOf, hf] at h; subst h; rfl

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

theorem an_identity_the_fleet_does_not_hold_queues_nothing {fleet : Fleet} {r : Request}
    (h : fleet r.agent = none) : queued fleet r = none := by
  simp [queued, turnOf, h]

structure Supplied where
  agent : Nat
  machine : Nat
  kind : Nat

theorem any_routing_can_be_supplied (a m k : Nat) :
    ∃ s : Supplied, s.agent = a ∧ s.machine = m ∧ s.kind = k :=
  ⟨⟨a, m, k⟩, rfl, rfl, rfl⟩

structure Order where
  agent : Option Nat
  credential : Option Nat
  deriving DecidableEq

abbrev Armed := Nat → Option Nat

def orderOf (armed : Armed) : Intent → Option Order
  | .command _ => some ⟨none, none⟩
  | .turn t => (armed t.agent).map fun c => ⟨some t.agent, some c⟩

inductive Reported where
  | running
  | failed
  deriving DecidableEq

def beat (armed : Armed) (i : Intent) : Reported × Option Order :=
  match orderOf armed i with
  | none => (.failed, none)
  | some o => (.running, some o)

theorem a_refused_fetch_starts_nothing {armed : Armed} {t : Turn} (h : armed t.agent = none) :
    beat armed (.turn t) = (.failed, none) := by
  simp [beat, orderOf, h]

theorem nothing_starts_unarmed {armed : Armed} {t : Turn} {o : Order}
    (h : beat armed (.turn t) = (.running, some o)) : ∃ c, armed t.agent = some c := by
  cases hf : armed t.agent with
  | none => simp [beat, orderOf, hf] at h
  | some c => exact ⟨c, rfl⟩

theorem a_turn_starts_with_the_credential_the_center_holds_for_it {armed : Armed} {t : Turn} {o : Order}
    (h : beat armed (.turn t) = (.running, some o)) :
    o.agent = some t.agent ∧ o.credential = armed t.agent := by
  cases hf : armed t.agent with
  | none => simp [beat, orderOf, hf] at h
  | some c => simp [beat, orderOf, hf] at h; subst h; exact ⟨rfl, rfl⟩

theorem a_credentialed_turn_does_start {armed : Armed} {t : Turn} {c : Nat} (h : armed t.agent = some c) :
    (beat armed (.turn t)).1 = Reported.running ∧ (beat armed (.turn t)).2 ≠ none := by
  simp [beat, orderOf, h]

theorem another_identity_s_credential_is_never_substituted (armed : Armed) (t : Turn) (other c : Nat)
    (hne : other ≠ t.agent) :
    orderOf (fun a => if a = other then some c else armed a) (.turn t) = orderOf armed (.turn t) := by
  have h : ¬ (t.agent = other) := fun he => hne he.symm
  simp [orderOf, h]

theorem a_command_is_handed_no_credential {armed : Armed} {c : Command} {o : Order}
    (h : beat armed (.command c) = (.running, some o)) : o.credential = none := by
  simp [beat, orderOf] at h
  subst h
  rfl

theorem a_command_is_untouched_by_the_fleet (armed₁ armed₂ : Armed) (c : Command) :
    beat armed₁ (.command c) = beat armed₂ (.command c) := by
  simp [beat, orderOf]

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

inductive Dialect where
  | claude
  | codex
  | gemini
  | pi
  | custom
  deriving DecidableEq

def canBeTold : Dialect → Bool
  | .claude => true
  | .codex => true
  | .gemini => false
  | .pi => false
  | .custom => false

theorem only_the_two_dialects_that_have_a_route_can_be_told :
    canBeTold .claude = true ∧ canBeTold .codex = true ∧
    canBeTold .gemini = false ∧ canBeTold .pi = false ∧ canBeTold .custom = false := by
  simp [canBeTold]

def delivered (told asked : Bool) : Option Bool :=
  if asked then (if told then some true else none) else some false

theorem a_dialect_that_cannot_be_told_is_refused_rather_than_dropped :
    delivered false true = none := rfl

theorem what_was_asked_for_is_what_is_delivered : delivered true true = some true := rfl

theorem the_only_way_to_deliver_nothing_is_to_have_asked_for_nothing {told asked : Bool}
    (h : delivered told asked = some false) : asked = false := by
  cases asked <;> cases told <;> simp [delivered] at h ⊢

end Arming
