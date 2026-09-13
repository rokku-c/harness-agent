/-
  Reloading one app in place — `apps/effect-server/src/boot/reload.ts`.

  Replacing a single app has the same shape as replacing a kernel, and the same
  hazard. `effect-host`'s `register()` replaces **by plugin id** and unloads the
  previous entry itself (`lifecycle.ts:26`), so from the moment the incoming
  generation registers, the generation it displaces is gone. A refusal *after*
  that moment — a surface the policy rejects — would leave the app with nothing
  serving it, and the caller's `{ ok: false }` is all anyone would hear. There is
  no error message for "the app is down".

  So every refusal path in the file puts the serving generation back, and that is
  the claim here: at each point an attempt can give up, the host serves what it
  served before the attempt. `committed` is the one path that ends somewhere
  else, and it ends where it says.

  **Refusing before anything is registered** — `refused_before_registering_moves_nothing`:
  the app is not loaded, its manifest names no module, the module cannot be
  imported, or what it exports is not this app. Four answers, one state, and it
  is the state the attempt started in. These are the paths a proof is worth
  having for at all: nothing threw where anyone was looking.

  **Refusing after** — `every_refusal_leaves_the_serving_generation_serving`, and
  `a_refusal_that_forgets_the_restore_leaves_the_app_down` is the other version,
  stated as both halves because "the old generation was given up" and "the new one
  never took" are each survivable and together are not.

  Modelling note: what is modelled is the order of the steps, not the host. The
  two conditions are `registerEffectApp` and `assessSurfaceChange`, and the fact
  that a *taken-over* dispatcher cannot be retired by a stale disposer is proven
  separately — `Lifecycle.lean` for the registry record, `Reload.lean` for the
  generation copies a rollback re-imports. What this adds is that no path through
  the attempt ends anywhere but back where it started. The file's generation
  *numbering* is `Reload.lean`'s subject and is not repeated here.
-/

namespace EffectServer

/-- The host, as far as one reload can see it: which generation holds this app's
plugin id. `registerEffectApp` replaces by id, so there is never more than one,
and never a moment where the app is registered but not serving. -/
abbrev Host := Option Nat

/-- One step of an attempt, named for what it does to the host rather than for what
it does to the registry. `adjudicate` moves nothing: it is a check made *about*
the registration that is now serving. -/
inductive Step where
  | register
  | adjudicate
  | dispose
  | restore
deriving DecidableEq, Repr

/-- `restore` ignores the state it is applied to. Registering the serving
generation again replaces whatever holds the app id now — the refused generation,
or nothing, if `dispose` already ran. That is what makes the `dispose` before it
tidy rather than load-bearing, and it is why no path below depends on their
order. -/
def next (serving : Nat) (incoming : Nat) : Host → Step → Host
  | _, Step.register => some incoming
  | s, Step.adjudicate => s
  | _, Step.dispose => none
  | _, Step.restore => some serving

/-- Giving up: hand the incoming registration back, then put the serving one in
its place. Both refusal paths that follow a registration end with exactly these
two steps, which is why they are one definition. -/
def giveUp (serving : Nat) (incoming : Nat) (s : Host) : Host :=
  next serving incoming (next serving incoming s Step.dispose) Step.restore

/-- Refused before the incoming generation was ever registered: the four answers
`not-loaded`, `no-module`, an import that threw, and a module exporting another
app. The file reaches this state by returning early; `failed` reaches it by
re-committing the generation that is still serving. -/
def refusedBeforeRegistering (serving : Nat) : Host := some serving

/-- Registered, then refused at the module: the registration itself threw. -/
def refusedAtRegister (serving : Nat) (incoming : Nat) : Host :=
  giveUp serving incoming (some serving)

/-- Registered, then refused: the policy did not accept the surface it produced. -/
def refusedAtAdjudication (serving : Nat) (incoming : Nat) : Host :=
  giveUp serving incoming (next serving incoming (some serving) Step.register)

/-- The one path that commits, and the only one that ends somewhere new. -/
def committed (serving : Nat) (incoming : Nat) : Host :=
  next serving incoming (next serving incoming (some serving) Step.register) Step.adjudicate

/-- Nothing an attempt can decide before it registers can be seen on the host. -/
theorem refused_before_registering_moves_nothing (serving : Nat) :
    refusedBeforeRegistering serving = (some serving : Host) := rfl

/-- Every point the attempt can give up returns the host to the generation it was
serving, and the point that does not give up serves the incoming one. -/
theorem every_refusal_leaves_the_serving_generation_serving (serving : Nat) (incoming : Nat) :
    refusedBeforeRegistering serving = some serving ∧
    refusedAtRegister serving incoming = some serving ∧
    refusedAtAdjudication serving incoming = some serving ∧
    committed serving incoming = some incoming := by
  refine ⟨rfl, ?_, ?_, ?_⟩ <;>
    simp [refusedAtRegister, refusedAtAdjudication, committed, giveUp, next]

/-- The same attempt with the restore left out. It starts by serving a generation
and ends serving none — the state the file's every refusal path exists to not
reach, and the one no error message accompanies. -/
theorem a_refusal_that_forgets_the_restore_leaves_the_app_down (serving : Nat) (incoming : Nat) :
    (some serving : Host) ≠ none ∧
    next serving incoming (next serving incoming (some serving) Step.register) Step.dispose = none := by
  refine ⟨?_, ?_⟩
  · simp
  · simp [next]

end EffectServer
