namespace Launch

inductive State where
  | queued
  | claimed
  | running
  | done
  | failed
  | cancelled

inductive Open : State → Prop where
  | queued : Open .queued
  | claimed : Open .claimed
  | running : Open .running

def Settled (state : State) : Prop := ¬ Open state

structure Intent where
  machine : Nat
  state : State
  claimedAt : Nat

def offered (ttl machine t : Nat) (i : Intent) : Prop :=
  i.machine = machine ∧ (i.state = .queued ∨ (i.state = .claimed ∧ i.claimedAt + ttl ≤ t))

def wasOffered (machine : Nat) (i : Intent) : Prop := i.machine = machine ∧ i.state = .queued

theorem what_is_handed_out_is_that_machine_s (h : offered ttl machine t i) : i.machine = machine :=
  h.1

theorem a_poll_only_hands_out_open_work (h : offered ttl machine t i) : Open i.state := by
  rcases h with ⟨-, hq | ⟨hc, -⟩⟩
  · rw [hq]; exact Open.queued
  · rw [hc]; exact Open.claimed

theorem an_answered_intent_is_offered_to_nobody (h : Settled i.state) : ¬ offered ttl machine t i :=
  fun hoff => h (a_poll_only_hands_out_open_work hoff)

theorem an_abandoned_claim_was_never_offered_again (h : i.state = .claimed) :
    ∀ machine, ¬ wasOffered machine i := by
  intro machine hoff
  rcases hoff with ⟨-, hq⟩
  rw [h] at hq
  cases hq

theorem a_live_claim_is_not_offered (h : i.state = .claimed) (h2 : t < i.claimedAt + ttl) :
    ¬ offered ttl machine t i := by
  rintro ⟨-, hq | ⟨hc, hl⟩⟩
  · rw [h] at hq; cases hq
  · rw [h] at hc; omega

theorem a_lapsed_claim_is_offered_again (h : i.state = .claimed) (h2 : i.claimedAt + ttl ≤ t)
    (h3 : i.machine = machine) : offered ttl machine t i :=
  ⟨h3, Or.inr ⟨h, h2⟩⟩

theorem what_a_poll_takes_lapses_back (ttl machine t : Nat) :
    offered ttl machine (t + ttl) ⟨machine, State.claimed, t⟩ :=
  ⟨rfl, Or.inr ⟨rfl, Nat.le.refl⟩⟩

theorem a_started_intent_is_not_offered_again (h : i.state = .running) :
    ¬ offered ttl machine t i := by
  rintro ⟨-, hq | ⟨hc, -⟩⟩
  · rw [h] at hq; cases hq
  · rw [h] at hc; cases hc

end Launch
