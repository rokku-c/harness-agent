/-
  In-flight accounting at the dispatch point — `packages/effect-host/src/dispatch-counts.ts`
  and `dispatch-point.ts` (§6.5-5 of docs/architecture-rework.md).

  A flip is one assignment, and that is only safe because the displaced
  implementation is not stopped while it is still answering. Nothing enforces
  that but a count: `run` acquires the target it captured, `retire` waits for
  that count to reach zero, and the caller stops the target afterwards. Get the
  count wrong and one direction fails silently and the other hangs.

  **A release must land on the target the acquire named.** `run` captures
  `current` once, before awaiting, and releases what it captured — not what is
  current when it finishes. `releasing_the_current_target_lets_a_busy_target_read_as_drained`
  is one trace read both ways: two requests with a flip between them, where
  "release whatever is current" reads zero on a target that is still answering,
  so `retire` returns and the target is stopped mid-request.
  `releasing_the_current_target_leaves_the_captured_one_never_draining` is the
  other side — the target that really was captured reads one too high, so a
  `retire` of it waits for a request that has already finished.

  **A request inside a target keeps it from draining.** `drained t` resolves on
  the count reaching zero, so it cannot hold while an acquire on `t` is unmatched
  — `an_acquire_keeps_its_target_from_draining`, with
  `acquire_then_release_restores_the_count` the balance that makes the count mean
  anything.

  **A waiter is woken by the last release, not by a poll.**
  `the_wake_up_is_the_last_release` is the release that empties the target;
  `a_release_that_is_not_the_last_does_not_wake` is that it stays quiet while
  anything is still inside, so the wake-up is the event itself and cannot be
  missed.

  Idealisation: counts are `Nat`. A release on a target already at zero therefore
  saturates at zero rather than going below it — which is what the
  implementation's `?? 1` default on an untracked target does too, so an unpaired
  release reads as drained in both. Paired acquire and release, which `run`'s
  `finally` guarantees, is the case that matters.
-/

namespace EffectHost

/-- Requests in flight on each target. A target is a `Nat`; which kernel is which
is not part of the accounting. -/
abbrev Counts := Nat → Nat

/-- Nothing in flight anywhere: what a fresh dispatch point starts from. -/
def empty : Counts := fun _ => 0

def acquire (c : Counts) (t : Nat) : Counts := fun u => if u = t then c u + 1 else c u

def release (c : Counts) (t : Nat) : Counts := fun u => if u = t then c u - 1 else c u

/-- What `drained t` resolves on: nothing is inside `t`. -/
def drained (c : Counts) (t : Nat) : Prop := c t = 0

/-- A step on one target leaves another target's count untouched — the reason a
flip mid-request cannot move a release onto the wrong target unless the release
asks for the wrong one. -/
theorem acquire_other (c : Counts) {u t : Nat} (h : u ≠ t) : acquire c t u = c u := by
  simp [acquire, h]

theorem acquire_same (c : Counts) (t : Nat) : acquire c t t = c t + 1 := by
  simp [acquire]

theorem release_other (c : Counts) {u t : Nat} (h : u ≠ t) : release c t u = c u := by
  simp [release, h]

theorem release_same (c : Counts) (t : Nat) : release c t t = c t - 1 := by
  simp [release]

/-- A release on the target its acquire named puts the count back exactly. The
count is a balance, so a target reading zero really has nothing inside it. -/
theorem acquire_then_release_restores_the_count (c : Counts) (t : Nat) :
    release (acquire c t) t = c := by
  funext u
  by_cases h : u = t <;> simp [release, acquire, h]

/-- While an acquire on `t` is unmatched, `t` is not drained — so a `retire` of it
cannot return under a request that is still running. -/
theorem an_acquire_keeps_its_target_from_draining (c : Counts) (t : Nat) :
    ¬ drained (acquire c t) t := by
  simp [drained, acquire]

/-- The two-request trace: r1 enters on `a`, the dispatcher flips to `b`, r2 enters
on `b`, r1 finishes — releasing the target it captured before the flip. -/
def flipThenReleaseCaptured (c : Counts) (a b : Nat) : Counts :=
  release (acquire (acquire c a) b) a

/-- The same trace, with r1 releasing whatever is current when it finishes. -/
def flipThenReleaseCurrent (c : Counts) (a b : Nat) : Counts :=
  release (acquire (acquire c a) b) b

/-- Releasing what is current lets a target that is answering a request read as
drained: `retire` returns, the caller stops it, and the request inside it is
answered by a stopped implementation with nothing to say so. Releasing what was
captured leaves it at one, which is the truth. -/
theorem releasing_the_current_target_lets_a_busy_target_read_as_drained
    (a b : Nat) (fresh : a ≠ b) :
    drained (flipThenReleaseCurrent empty a b) b ∧
    (flipThenReleaseCaptured empty a b) b = 1 := by
  have other : b ≠ a := Ne.symm fresh
  refine ⟨?_, ?_⟩
  · show release (acquire (acquire empty a) b) b b = 0
    rw [release_same, acquire_same, acquire_other _ other]
    simp [empty]
  · show release (acquire (acquire empty a) b) a b = 1
    rw [release_other _ other, acquire_same, acquire_other _ other]
    simp [empty]

/-- The other side of the same mistake: the target that was captured is left one
too high, so `retire` waits on it for a request that has already finished. -/
theorem releasing_the_current_target_leaves_the_captured_one_never_draining
    (a b : Nat) (fresh : a ≠ b) :
    ¬ drained (flipThenReleaseCurrent empty a b) a ∧
    drained (flipThenReleaseCaptured empty a b) a := by
  have other : b ≠ a := Ne.symm fresh
  refine ⟨?_, ?_⟩
  · show ¬ (release (acquire (acquire empty a) b) b a = 0)
    rw [release_other _ fresh, acquire_other _ fresh, acquire_same]
    simp [empty]
  · show release (acquire (acquire empty a) b) a a = 0
    rw [release_same, acquire_other _ fresh, acquire_same]
    simp [empty]

/-- The release that empties a target is the one that wakes its waiters: with the
last request still inside, one release leaves zero. -/
theorem the_wake_up_is_the_last_release (c : Counts) (t : Nat) (last : c t = 1) :
    (release c t) t = 0 := by
  rw [release_same, last]

/-- And it stays quiet while anything is still inside, so a `retire` cannot be
told a busy target is free. -/
theorem a_release_that_is_not_the_last_does_not_wake (c : Counts) (t : Nat) (busy : 2 ≤ c t) :
    (release c t) t ≠ 0 := by
  rw [release_same]
  omega

end EffectHost
