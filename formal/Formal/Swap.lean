/-
  The swap — `packages/effect-bundle/src/supervisor-swap.ts`.

  Replacing a running kernel has two orders available. Load the new one and
  point the dispatcher at it, then stop the old one — or stop the old one first
  and load the new one after. The first is the file's, and the file says why in
  its own header: **A is never stopped before the flip is committed**, so a
  failure anywhere up to that point is the swap not having moved.

  That sentence is the whole safety argument for hot-swapping an app, and
  nothing checked it. The failure it guards against has no error message: the
  old kernel is stopped, the new one turns out to be broken, and the host is
  serving nothing — a state that is not a step of any procedure but the place a
  run ends up in.

  So what is modelled is the pair of facts the sentence is about. A host's
  slots are what it is serving and what it still has loaded; a step moves them;
  and a run is the four steps in order, with a failure being the run stopping
  rather than a step. `the_declared_order_never_points_at_a_stopped_kernel` is
  the invariant at each of the four moments — including the one that matters,
  the moment the new kernel starts serving while the old one is still loaded.
  `unloading_first_points_the_dispatcher_at_nothing` is the other order, where
  the old kernel is gone before the new one is even staged: stated as both
  halves, because "the dispatcher points at it" and "it is not loaded" are each
  survivable and together are not.

  Modelling note: this models the *ordering*, not the supervisor. Staging,
  the compat matrix and the health check are the conditions under which a flip
  is allowed to happen at all — they are `refusalFor` and `adopt` in
  `supervisor-runtime.ts`, one file over; what a flip does to the slots is four
  lines. The identity of the two kernels is the only thing carried, because the
  whole question is which one is behind the other.
-/

namespace EffectBundle

/-- The host's two slots, at one moment of a swap. -/
structure Slots where
  /-- The kernel the request dispatcher points at, if any. -/
  serving : Option String
  /-- Kernels still loaded, and so still able to take a request. -/
  loaded : List String
deriving DecidableEq, Repr

/-- A host that has been running: one kernel serves, and it is loaded. -/
def running (a : String) : Slots := { serving := some a, loaded := [a] }

/-- The steps of a swap, named for what they do to the host rather than for what
they do to disk. `commit` moves nothing: it is the supervisor's record that the
flip happened, which is why it can sit on either side of the stop and the
invariant below is unaffected. -/
inductive Step where
  | stage
  | flip
  | commit
  | stopOld
deriving DecidableEq, Repr

/-- `stopOld` takes the old kernel, so the step needs to know which one that is.
The new kernel's id comes with the step for the same reason. -/
def next (a b : String) : Slots → Step → Slots
  | s, Step.stage => { s with loaded := b :: s.loaded }
  | s, Step.flip => { s with serving := some b }
  | s, Step.commit => s
  | s, Step.stopOld => { s with loaded := s.loaded.erase a }

/-- Whether the dispatcher points at a kernel that is loaded. A dispatcher
pointing at a kernel that has been stopped is a request with nowhere to go, and
it is the state the second order below reaches. -/
def servesALoaded (s : Slots) : Bool :=
  match s.serving with
  | none => true
  | some k => s.loaded.contains k

/-- The four moments of a swap, named so the invariant can be stated at each of
them rather than only at the end. A failure is the run stopping, so "only at the
end" would be the one moment a failure does not reach. -/
def afterStage (a b : String) : Slots := next a b (running a) Step.stage
def afterFlip (a b : String) : Slots := next a b (afterStage a b) Step.flip
def afterCommit (a b : String) : Slots := next a b (afterFlip a b) Step.commit
def afterStop (a b : String) : Slots := next a b (afterCommit a b) Step.stopOld

/-- At every moment of the declared order the dispatcher points at a kernel that
is loaded. The moment that matters is `afterFlip`: the new kernel is serving
while the old one is still loaded, so a new kernel that turns out to be broken
has somewhere to go back to. The old kernel is the last thing to go. -/
theorem the_declared_order_never_points_at_a_stopped_kernel (a b : String) (h : a ≠ b) :
    servesALoaded (running a) = true ∧
    servesALoaded (afterStage a b) = true ∧
    servesALoaded (afterFlip a b) = true ∧
    servesALoaded (afterCommit a b) = true ∧
    servesALoaded (afterStop a b) = true := by
  refine ⟨?_, ?_, ?_, ?_, ?_⟩ <;>
    simp [servesALoaded, running, afterStage, afterFlip, afterCommit, afterStop, next,
      beq_iff_eq, h, Ne.symm h]

/-- And the order this exists to not be: stop the old kernel first. Now the
dispatcher still points at it and it is no longer loaded — the host is serving
nothing, before the new kernel has even been staged. Stated as both halves,
because either alone sounds survivable. -/
theorem unloading_first_points_the_dispatcher_at_nothing (a b : String) :
    (next a b (running a) Step.stopOld).serving = some a ∧
    (next a b (running a) Step.stopOld).loaded = [] := by
  simp [next, running]

end EffectBundle
