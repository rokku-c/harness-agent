namespace EffectHost

structure Chain where
  newest : Option Nat
  waitsFor : Nat → Option Nat

def nothingQueued : Chain := { newest := none, waitsFor := fun _ => none }

def submit (c : Chain) (n : Nat) : Chain :=
  { newest := some n, waitsFor := fun m => if m = n then c.newest else c.waitsFor m }

def finish (c : Chain) (n : Nat) : Chain :=
  if c.newest = some n then { c with newest := none } else c

def finishWithoutChecking (c : Chain) (_n : Nat) : Chain := { c with newest := none }

theorem a_submission_waits_for_what_was_queued (c : Chain) (n : Nat) :
    (submit c n).waitsFor n = c.newest ∧ (submit c n).newest = some n := by
  simp [submit]

def threeQueued : Chain := submit (submit (submit nothingQueued 1) 2) 3

theorem the_links_form_a_line_back_to_the_first_operation :
    threeQueued.waitsFor 3 = some 2 ∧
    threeQueued.waitsFor 2 = some 1 ∧
    threeQueued.waitsFor 1 = none ∧
    threeQueued.newest = some 3 := by
  decide

theorem the_guard_keeps_the_queued_link_for_the_next_operation
    (c : Chain) (stale queued : Nat) (tail : c.newest = some queued) (diff : stale ≠ queued) :
    (finish c stale).newest = some queued ∧
    (submit (finish c stale) (queued + 1)).waitsFor (queued + 1) = some queued := by
  have ne : queued ≠ stale := Ne.symm diff
  refine ⟨?_, ?_⟩ <;> simp [finish, submit, tail, ne]

theorem without_the_guard_the_next_operation_waits_for_nothing :
    (finishWithoutChecking threeQueued 1).newest = none ∧
    (submit (finishWithoutChecking threeQueued 1) 4).waitsFor 4 = none := by
  decide

end EffectHost
