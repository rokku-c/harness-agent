/-
  Reversible registration — `packages/effect-interface/src/registry.ts`.

  An app registers an interface and is handed a disposer. Disabling the app
  calls it, and the registry has to come back to what it was: an app turned off
  and on again is not a new app, and a registry that keeps a ghost entry per
  cycle is a registry that leaks. So registration is a reversible effect — the
  host registers and revokes with lifecycle symmetry — and this file is what
  that symmetry owes.

  The registry is modelled as a function from id to the registration holding it,
  which is what the implementation's `Map` is. Two ids cannot collide, because a
  function has one value per argument; nothing below has to assume it.

  What is proven:

  * `dispose_set` — register then dispose erases that one id and moves nothing
    else. This is the symmetry, stated exactly: what comes back is the registry
    it was handed, with that id gone.
  * `dispose_set_gone` — so what the disposer was handed is not in the registry
    afterwards. Registering and revoking leaves no ghost.
  * `dispose_idempotent` — calling a disposer twice is calling it once, which is
    what makes it safe in a teardown that may already have run.
  * `dispose_commutes` — one app's teardown never reaches another's
    registration: revoking one commutes with registering another.

  Those four are the symmetry. The guard is the part worth stating as a
  counterexample. A disposer does not clear "whatever holds this id" — it clears
  *its own* registration, and only while that registration is still the one
  holding the id. One id can be claimed twice, because reloading an app replaces
  it. Without the check, the disposer of the registration that was replaced
  deletes the one that replaced it: the app that just came up goes down, and
  `stale_disposer_takes_the_new_one` is exactly that run.
-/

namespace EffectHost

/-- One registration: the id it claims, and the identity that tells it apart from
a later registration claiming the same id. -/
structure Reg where
  id : String
  gen : Nat
deriving DecidableEq, Repr

/-- The registry, as the map it is: one registration per id, or none. -/
abbrev Registry := String → Option Reg

/-- Register: the id points at this registration, wherever it pointed before. -/
def set (r : Reg) (reg : Registry) : Registry :=
  fun id => if id = r.id then some r else reg id

/-- The registry with one id's registration gone. -/
def eraseId (a : String) (reg : Registry) : Registry :=
  fun id => if id = a then none else reg id

/-- The disposer, with the guard the implementation carries: it clears the id only
while the registration holding it is still its own. A registration a later one
replaced is already gone, so there is nothing of its own to clear. -/
def dispose (r : Reg) (reg : Registry) : Registry :=
  fun id => if id = r.id then (if reg id = some r then none else reg id) else reg id

/-- The disposer without that guard: it clears the id, whoever holds it. -/
def disposeById (a : String) (reg : Registry) : Registry := eraseId a reg

/-! ### The symmetry -/

/-- Register then dispose: that one id is erased and nothing else moved. -/
theorem dispose_set (r : Reg) (reg : Registry) : dispose r (set r reg) = eraseId r.id reg := by
  funext id
  by_cases h : id = r.id
  · subst h; simp [dispose, eraseId, set]
  · simp [dispose, eraseId, set, h]

/-- So the registration the disposer was made for is not in the registry
afterwards — registering and revoking leaves no ghost. -/
theorem dispose_set_gone (r : Reg) (reg : Registry) : dispose r (set r reg) r.id = none := by
  rw [dispose_set]; simp [eraseId]

/-- Nothing had claimed the id: then there is nothing to erase, and the registry
the disposer hands back is the registry it was handed. -/
theorem dispose_set_restores (r : Reg) (reg : Registry) (h : reg r.id = none) :
    dispose r (set r reg) = reg := by
  rw [dispose_set]
  funext id
  by_cases hid : id = r.id
  · subst hid; simp [eraseId, h]
  · simp [eraseId, hid]

/-- Calling a disposer twice is calling it once: the `disposed` flag, which is
what makes it safe in a teardown that may already have run. -/
theorem dispose_idempotent (r : Reg) (reg : Registry) : dispose r (dispose r reg) = dispose r reg := by
  funext id
  by_cases h : id = r.id
  · subst h; simp [dispose]
  · simp [dispose, h]

/-- Revoking one registration commutes with registering another: one app's
teardown never reaches a different app's registration. -/
theorem dispose_commutes {r₁ r₂ : Reg} (h : r₁.id ≠ r₂.id) (reg : Registry) :
    dispose r₁ (set r₂ reg) = set r₂ (dispose r₁ reg) := by
  funext id
  by_cases h₁ : id = r₁.id
  · have h₂ : ¬(id = r₂.id) := fun hh => h (by rw [← h₁]; exact hh)
    subst h₁; simp [dispose, set, h₂]
  · by_cases h₂ : id = r₂.id
    · subst h₂; simp [dispose, set, h₁]
    · simp [dispose, set, h₁, h₂]

/-! ### The guard, and what it is for -/

/-- A reload: the app comes up again under the id it already had. -/
def reload (reg : Registry) (r : Reg) : Registry := set r reg

/-- With the identity check, the disposer of the replaced registration is inert —
the registration that replaced it is still up. -/
theorem stale_disposer_spares_the_new_one {old fresh : Reg} (hid : old.id = fresh.id)
    (hne : old ≠ fresh) (reg : Registry) : dispose old (reload reg fresh) old.id = some fresh := by
  have hheld : (reload reg fresh) old.id = some fresh := by simp [reload, set, hid]
  have hnot : ¬(some fresh = some old) := fun he => hne (Option.some.inj he).symm
  rw [dispose, if_pos rfl, hheld, if_neg hnot]

/-- Without it, that disposer clears the id and takes the fresh registration down:
a teardown that had already been replaced turns off the app that replaced it. -/
theorem stale_disposer_takes_the_new_one {old fresh : Reg} (hid : old.id = fresh.id)
    (reg : Registry) : disposeById old.id (reload reg fresh) fresh.id = none := by
  simp [disposeById, eraseId, hid]

end EffectHost
