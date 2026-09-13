/-
  WHAT A CLAIM IS WORTH — `packages/agentd/src/launch-claim.ts`, which is the
  rule `packages/agentd/src/launches.ts` applies.

  The queue is a pull queue: an intent waits until the machine it names asks for
  it, and claiming is what makes it that machine's own. The file wrote
  `claimedAt` as it claimed and read it nowhere, so a claim had no end. A machine
  that claimed an intent and then went away — the probe crashed, the host
  rebooted — left it `claimed` for good: no poll offers what is not `queued`, so
  the work that was asked for is never handed out again to anyone, at any time,
  and nothing says so. Silence is the whole of the failure; the record simply
  reads as a machine's own forever.

  So a claim carries a deadline. It is not a transfer but a lease, and what it
  covered goes back when it lapses. Two lines bound it, and both matter: the
  deadline must not take an intent away from a machine that is still starting up,
  and it must stop at `claimed` — once a machine has said it started, the work
  may be half done, and handing it out a second time runs an agent twice in one
  directory. An intent left `running` by a machine that died mid-run stays
  visibly stuck, which is a record an operator can act on, and not the same thing
  as work quietly done twice.

  Modelling note: the encodings here are the file's own — a claim carries the
  reading it was made at, and `offered` compares with the same addition the file
  compares with. A claim with no reading is read as lapsed, which is the side the
  deadline errs on.
-/

namespace Launch

/-- The states an intent passes through; the last three are somebody's answer. -/
inductive State where
  | queued
  | claimed
  | running
  | done
  | failed
  | cancelled

/-- Whether the intent is still in play — the states that are not an answer. -/
inductive Open : State → Prop where
  | queued : Open .queued
  | claimed : Open .claimed
  | running : Open .running

/-- An answer, which no poll may hand out again. -/
def Settled (state : State) : Prop := ¬ Open state

/-- An intent as the queue holds it: whose it is, what state it is in, and — when
    a machine has claimed it — the reading that claim was made at. -/
structure Intent where
  machine : Nat
  state : State
  claimedAt : Nat

/-- What a poll at `t` may hand to `machine`: an intent nobody is holding —
    never claimed, or claimed so long ago that the machine that took it is not a
    machine any more. -/
def offered (ttl machine t : Nat) (i : Intent) : Prop :=
  i.machine = machine ∧ (i.state = .queued ∨ (i.state = .claimed ∧ i.claimedAt + ttl ≤ t))

/-- The rule the file had: whatever waits is whatever no machine has taken. -/
def wasOffered (machine : Nat) (i : Intent) : Prop := i.machine = machine ∧ i.state = .queued

/-- A machine is never handed another machine's work. -/
theorem what_is_handed_out_is_that_machine_s (h : offered ttl machine t i) : i.machine = machine :=
  h.1

/-- And it is never handed work that has been answered. -/
theorem a_poll_only_hands_out_open_work (h : offered ttl machine t i) : Open i.state := by
  rcases h with ⟨-, hq | ⟨hc, -⟩⟩
  · rw [hq]; exact Open.queued
  · rw [hc]; exact Open.claimed

/-- So an intent already answered is offered to nobody: not to this machine, not
    to another, and not after any deadline. -/
theorem an_answered_intent_is_offered_to_nobody (h : Settled i.state) : ¬ offered ttl machine t i :=
  fun hoff => h (a_poll_only_hands_out_open_work hoff)

/-- The bug, as the file's own rule states it: a claim is not waiting, so under
    that rule a claim is offered again to no machine and at no time — which is
    what "the work is never handed out again" means, said of every reading at
    once. -/
theorem an_abandoned_claim_was_never_offered_again (h : i.state = .claimed) :
    ∀ machine, ¬ wasOffered machine i := by
  intro machine hoff
  rcases hoff with ⟨-, hq⟩
  rw [h] at hq
  cases hq

/-- The deadline does not take an intent from a machine that may still be there:
    while a claim is inside its deadline nothing hands the intent to anyone. -/
theorem a_live_claim_is_not_offered (h : i.state = .claimed) (h2 : t < i.claimedAt + ttl) :
    ¬ offered ttl machine t i := by
  rintro ⟨-, hq | ⟨hc, hl⟩⟩
  · rw [h] at hq; cases hq
  · rw [h] at hc; omega

/-- And a claim that lapsed is offered again: the deadline is what keeps an
    intent a dead machine was holding from being lost with it. -/
theorem a_lapsed_claim_is_offered_again (h : i.state = .claimed) (h2 : i.claimedAt + ttl ≤ t)
    (h3 : i.machine = machine) : offered ttl machine t i :=
  ⟨h3, Or.inr ⟨h, h2⟩⟩

/-- What one poll takes is offered again one deadline later, to the machine it
    was taken for — so no intent is lost by the rule or by the write, which is
    what makes the lease a lease rather than a transfer. -/
theorem what_a_poll_takes_lapses_back (ttl machine t : Nat) :
    offered ttl machine (t + ttl) ⟨machine, State.claimed, t⟩ :=
  ⟨rfl, Or.inr ⟨rfl, Nat.le.refl⟩⟩

/-- The control: the deadline reaches `claimed` and stops there. A machine that
    has said it started keeps its intent however long it takes, because work that
    may be half done is not handed out a second time — the one thing a longer
    deadline must not buy. -/
theorem a_started_intent_is_not_offered_again (h : i.state = .running) :
    ¬ offered ttl machine t i := by
  rintro ⟨-, hq | ⟨hc, -⟩⟩
  · rw [h] at hq; cases hq
  · rw [h] at hc; cases hc

end Launch
