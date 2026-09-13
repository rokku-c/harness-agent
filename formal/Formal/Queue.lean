/-
  The lifecycle queue — `packages/effect-host/src/queue.ts`.

  §6.6 hands the double buffer its safety: "the lifecycle queue serializes every
  change; change races are already handled". That is load-bearing — §6.2's flip is
  one pointer assignment only if a register and an unregister of the same id
  cannot interleave — and the whole of it is one guard in the bookkeeping:

      const release = () => { if (pending.get(id) === result) pending.delete(id) }

  Each operation is chained onto whatever is queued for its id when it is
  submitted. So the release that runs when an operation finishes must not clear a
  *newer* one that queued up behind it: clear that, and the next submission finds
  nothing to wait for and starts beside the operation still running instead of
  after it. Nothing reports it — two changes to one plugin interleave and the
  loser is whichever wrote last.

  Modelled per id: which operation is queued last, and which operation each
  submission was told to wait for.
  `the_guard_keeps_the_queued_link_for_the_next_operation` is the guard;
  `without_the_guard_the_next_operation_waits_for_nothing` is the same moment
  without it, which is also why the first is not vacuous, and
  `the_links_form_a_line_back_to_the_first_operation` is that the links run back
  through the submission order rather than into a cycle.

  Idealisation: what is modelled is the links, not the promises. That an operation
  starts when the one it waits for settles is the runtime's `then`, which a model
  of this size cannot carry.
-/

namespace EffectHost

/-- One id's queue: the operation queued last, and what each submitted operation
was told to wait for. `none` for a wait is "nothing was queued" — the first
submission for an id, which starts at once. -/
structure Chain where
  newest : Option Nat
  waitsFor : Nat → Option Nat

/-- No operation queued for this id. -/
def nothingQueued : Chain := { newest := none, waitsFor := fun _ => none }

/-- Submit operation `n`: it waits for whatever is queued now, and becomes the new
tail. -/
def submit (c : Chain) (n : Nat) : Chain :=
  { newest := some n, waitsFor := fun m => if m = n then c.newest else c.waitsFor m }

/-- An operation finished: drop the tail, but only if it is still this one. Not
`release` — that is the in-flight count, and the two must not be confused for one
another. -/
def finish (c : Chain) (n : Nat) : Chain :=
  if c.newest = some n then { c with newest := none } else c

/-- The tempting version: the operation finished, so clear the id. -/
def finishWithoutChecking (c : Chain) (_n : Nat) : Chain := { c with newest := none }

/-- A submission waits for the operation queued before it, and becomes the tail. -/
theorem a_submission_waits_for_what_was_queued (c : Chain) (n : Nat) :
    (submit c n).waitsFor n = c.newest ∧ (submit c n).newest = some n := by
  simp [submit]

/-- Three operations submitted to one id: 1, then 2 behind it, then 3. -/
def threeQueued : Chain := submit (submit (submit nothingQueued 1) 2) 3

/-- The links are a line: each waits for the one before it, the first waits for
nothing because nothing was queued, and the tail is the last submitted. -/
theorem the_links_form_a_line_back_to_the_first_operation :
    threeQueued.waitsFor 3 = some 2 ∧
    threeQueued.waitsFor 2 = some 1 ∧
    threeQueued.waitsFor 1 = none ∧
    threeQueued.newest = some 3 := by
  decide

/-- A release by an operation that is no longer the tail leaves the queue alone:
whoever is queued behind it is still what the next submission waits for. This is
the guard, and it is what makes an operation's finishing a private event. -/
theorem the_guard_keeps_the_queued_link_for_the_next_operation
    (c : Chain) (stale queued : Nat) (tail : c.newest = some queued) (diff : stale ≠ queued) :
    (finish c stale).newest = some queued ∧
    (submit (finish c stale) (queued + 1)).waitsFor (queued + 1) = some queued := by
  have ne : queued ≠ stale := Ne.symm diff
  refine ⟨?_, ?_⟩ <;> simp [finish, submit, tail, ne]

/-- The same moment without the guard, on the queue above: the first operation
finishes while the second and third are waiting, the id is cleared anyway, and the
fourth submission has nothing to wait for — so it runs beside them, and two
changes to one plugin are in flight at once. -/
theorem without_the_guard_the_next_operation_waits_for_nothing :
    (finishWithoutChecking threeQueued 1).newest = none ∧
    (submit (finishWithoutChecking threeQueued 1) 4).waitsFor 4 = none := by
  decide

end EffectHost
