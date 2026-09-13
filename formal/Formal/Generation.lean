/-
  One app's generation swap — `packages/effect-apps/src/registration/install.ts`.

  Replacing a single app has the same shape as replacing a kernel, and the same
  hazard. `effect-host`'s `register()` replaces **by plugin id** and unloads the
  previous entry itself (`lifecycle.ts:26`), so from the moment the incoming
  generation registers, the generation it displaces is gone. A refusal *after*
  that moment — a surface the policy rejects, a probe that throws — would leave
  the app with nothing serving it, and the caller's `{ ok: false }` is all anyone
  would hear. There is no error message for "the app is down".

  So every refusal path in the file ends with `restore(before)`, and that is the
  claim here: at each of the three points where an attempt can give up, the host
  serves what it served before the attempt. `committed` is the one path that ends
  somewhere else, and it ends where it says.

  `a_refusal_that_forgets_the_restore_leaves_the_app_down` is the other version,
  stated as both halves because "the old generation was given up" and "the new one
  never took" are each survivable and together are not.

  Modelling note: what is modelled is the order of the steps, not the host. The
  three conditions are `registerEffectApp`, `assessSurfaceChange` and
  `options.probe`, and the fact that a *stale* disposer cannot revoke the
  generation restored over it is proven one file over, in `Lifecycle.lean`. What
  this adds is that no path through the attempt ends anywhere but back where it
  started. `generations.ts`'s rollback is deliberately not modelled a second time:
  it is this run with the previous generation as the incoming one.
-/

namespace EffectApps

/-- The host, as far as one attempt can see it: which generation of this app holds
its plugin id. `register()` replaces by id, so there is never more than one, and
never a moment where the app is registered but not serving. -/
abbrev Host := Option Nat

/-- One step of an attempt, named for what it does to the host rather than for what
it does to the registry. `adjudicate` and `probe` move nothing: they are checks
made *about* the registration that is now serving. -/
inductive Step where
  | register
  | adjudicate
  | probe
  | dispose
  | restore
deriving DecidableEq, Repr

/-- `restore` ignores the state it is applied to. Registering the displaced
generation again replaces whatever holds the app id now — the refused generation,
or nothing, if `dispose` already ran. That is what makes the `dispose` before it
tidy rather than load-bearing, and it is why no path below depends on their
order. -/
def next (before : Host) (incoming : Nat) : Host → Step → Host
  | _, Step.register => some incoming
  | s, Step.adjudicate => s
  | s, Step.probe => s
  | _, Step.dispose => none
  | _, Step.restore => before

/-- Giving up: hand the incoming registration back, then put the displaced one in
its place. Every refusal path ends with exactly these two steps, which is why they
are one definition. -/
def giveUp (before : Host) (incoming : Nat) (s : Host) : Host :=
  next before incoming (next before incoming s Step.dispose) Step.restore

/-- The module threw, so nothing about the attempt reached the host. -/
def refusedAtRegister (before : Host) (_incoming : Nat) : Host := before

/-- Registered, then refused: the policy did not accept the surface it produced. -/
def refusedAtAdjudication (before : Host) (incoming : Nat) : Host :=
  giveUp before incoming (next before incoming before Step.register)

/-- Registered, accepted, then refused: the probe threw. -/
def refusedAtProbe (before : Host) (incoming : Nat) : Host :=
  giveUp before incoming
    (next before incoming (next before incoming before Step.register) Step.adjudicate)

/-- The one path that commits, and the only one that ends somewhere new. -/
def committed (before : Host) (incoming : Nat) : Host :=
  next before incoming
    (next before incoming (next before incoming before Step.register) Step.adjudicate)
    Step.probe

/-- Every point the attempt can give up returns the host to the generation it was
serving, and the point that does not give up serves the incoming one. -/
theorem every_refusal_leaves_the_displaced_generation_serving
    (before : Host) (incoming : Nat) :
    refusedAtRegister before incoming = before ∧
    refusedAtAdjudication before incoming = before ∧
    refusedAtProbe before incoming = before ∧
    committed before incoming = some incoming := by
  refine ⟨rfl, ?_, ?_, ?_⟩ <;>
    simp [refusedAtAdjudication, refusedAtProbe, committed, giveUp, next]

/-- The same attempt with the restore left out. It starts by serving a generation
and ends serving none — the state the file's every refusal path exists to not
reach, and the one no error message accompanies. -/
theorem a_refusal_that_forgets_the_restore_leaves_the_app_down (b : Nat) (incoming : Nat) :
    (some b : Host) ≠ none ∧
    next (some b) incoming (next (some b) incoming (some b) Step.register) Step.dispose = none := by
  refine ⟨?_, ?_⟩
  · simp
  · simp [next]

end EffectApps
