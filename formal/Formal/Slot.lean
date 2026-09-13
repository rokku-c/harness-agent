/-
  App generations — `packages/effect-apps/src/registration/generations.ts`.

  That file's own header says what it owns: "the history — which generation is
  live, what displaced what", supplied to `install.ts` through two seams. The
  history is what makes a per-app rollback possible at all, and its contract is
  one sentence in `slot.ts`: `previous()` is "the generation the current one
  displaced — the rollback target".

  Two ways that goes wrong quietly. A commit that makes the slot the new
  generation instead of *joining* it leaves nothing behind — `rollback` then
  refuses out loud, which is the good case. The bad case is subtler: take the
  target from the wrong end of the history and rollback hands back the oldest
  generation the app ever had. The app comes up, serves, and is wrong — an
  ancient version restored as if it were the one just displaced.

  So the two theorems say the target is the *second-newest* commit, and the
  concrete state below is the control: the same moment read from the wrong end
  names a generation that was never displaced, and `rolling_back_twice_…` is
  that the door swings both ways rather than being one-way.

  Idealisation: a generation is the descriptor it installs. The disposer, the
  surface it registered, and the host's register/dispose behaviour live in
  `Formal.Generation.lean` (which generation serves) and `Formal.Lifecycle.lean`
  (whose records a disposer may remove).
-/

namespace EffectApps

/-- A slot's history: one entry per committed generation, by the descriptor it
installs, oldest first. -/
abbrev History := List Nat

/-- The live generation — the newest commit. -/
def live (h : History) : Option Nat := h.reverse.head?

/-- The generation the live one displaced — the rollback target. The second-newest
commit, which is why it is `tail` before `head?` and not the other way round. -/
def displaced (h : History) : Option Nat := h.reverse.tail.head?

/-- A commit: the new generation joins the history, and what it displaced stays in
it. Retaining the displaced entry *is* the rollback target. -/
def commit (h : History) (d : Nat) : History := h ++ [d]

/-- The tempting commit: the new generation *is* the slot now. -/
def commitReplacing (_h : History) (d : Nat) : History := [d]

/-- Roll back: reinstall the displaced generation as a fresh commit, so the history
keeps both and the generation being left becomes the new target. -/
def rollback (h : History) : Option History := (displaced h).map (fun d => h ++ [d])

/-- The rollback target read from the wrong end: the oldest generation ever. -/
def oldest (h : History) : Option Nat := h.head?

theorem a_commit_puts_the_new_generation_in_service (h : History) (d : Nat) :
    live (commit h d) = some d := by
  simp [live, commit, List.reverse_append]

theorem a_commit_keeps_what_it_displaced_as_the_rollback_target (h : History) (d : Nat) :
    displaced (commit h d) = live h := by
  simp [displaced, live, commit, List.reverse_append]

theorem rolling_back_commits_the_generation_it_displaced
    (h : History) (d : Nat) (target : displaced h = some d) :
    rollback h = some (commit h d) ∧ live (commit h d) = some d := by
  refine ⟨?_, a_commit_puts_the_new_generation_in_service h d⟩
  simp [rollback, commit, target]

theorem rolling_back_twice_returns_the_generation_it_left (h : History) (d e : Nat)
    (top : live h = some e) :
    rollback (commit h d) = some (commit (commit h d) e) := by
  have target : displaced (h ++ [d]) = some e := by
    simpa [displaced, live, List.reverse_append] using top
  simp [rollback, commit, target]

/-- Two generations committed to one slot: `10`, then `20`. -/
def twoCommitted : History := commit (commit [] 10) 20

/-- The target of the commit that comes next is the generation it displaces — `20`,
the one serving — and not `10`, the oldest the slot has ever had. Reading the
target from the wrong end is the control: it names `10`, a generation that was
never displaced, and a rollback to it is the app coming up wrong. -/
theorem the_rollback_target_is_what_was_displaced_not_the_oldest :
    displaced (commit twoCommitted 30) = some 20 ∧ oldest (commit twoCommitted 30) = some 10 := by
  decide

/-- A commit that replaces the history instead of joining it leaves nothing behind,
so `previous()` is undefined. Loud at the `rollback` call, which is why that half
is the good case. -/
theorem replacing_the_history_loses_the_rollback_target :
    displaced (commitReplacing twoCommitted 30) = none ∧
    rollback (commitReplacing twoCommitted 30) = none := by
  decide

/-- A slot with no generations has no live one and nothing to roll back to. -/
def unload : History := []

theorem unloading_leaves_nothing_to_roll_back_to :
    live unload = none ∧ displaced unload = none ∧ rollback unload = none := by
  simp [unload, live, displaced, rollback]

end EffectApps
