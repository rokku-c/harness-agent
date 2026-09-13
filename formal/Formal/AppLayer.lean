/-
  The app layer's slots — `apps/effect-server/src/boot/app-layer.ts` (§6.5-6).

  A kernel swap suspends the apps it would break and loads them back afterwards.
  The file's header makes a claim about what that costs them: *suspended, not
  removed* — a suspension keeps the app's slot and gives up only its disposer, so
  restoring puts the app back where it was, and `stop()` still tears the layer down
  in reverse load order. Nothing checked that claim, and its failure is silent: a
  layer that appended a restored app would still load it, still serve it, still
  pass every test that asks "is it running" — and would tear the apps down in a
  different order on the way out, which is the one moment no test reaches.

  So two designs are modelled over one three-app layer. `suspending_holds_the_place`
  is the file's: give up the disposer, keep the slot, and a restore returns the
  layer *exactly* as it was. `appending_moves_the_app_to_the_end` is the other:
  a suspended app leaves the layer and comes back at the end, so teardown reaches
  it first. Both are stated about the same start, which is what makes them a pair
  rather than two unrelated facts.

  Modelling note: what a slot holds is whether its disposer is held. The disposer
  itself is not carried, so `swap` — which replaces one disposer with another in
  the slot it already occupies — is the identity here and is not modelled. The
  identity-guard that makes replacing it safe is `Lifecycle.lean`.
-/

namespace EffectApps

/-- One place in the layer: the app's id, and whether its disposer is held (it is
running) or given up (it is suspended). -/
abbrev Slot := String × Bool

/-- A layer is its slots in load order — which is the whole point, because teardown
walks that order backwards. -/
abbrev Layer := List Slot

/-- Three apps loaded at boot. -/
def start (a b c : String) : Layer := [(a, true), (b, true), (c, true)]

/-- The disposers teardown will call, in the order it will call them. -/
def running : Layer → List String
  | [] => []
  | s :: rest => if s.2 then s.1 :: running rest else running rest

/-- Suspend by holding the slot: the place is kept, only the disposer is given up. -/
def suspend (who : String) : Layer → Layer
  | [] => []
  | s :: rest => (s.1, if s.1 = who then false else s.2) :: suspend who rest

/-- Restore by writing the app back into the slot it holds. -/
def restore (who : String) : Layer → Layer
  | [] => []
  | s :: rest => (s.1, if s.1 = who then true else s.2) :: restore who rest

/-- The other design: a suspended app leaves the layer. -/
def eraseSlot (who : String) : Layer → Layer
  | [] => []
  | s :: rest => if s.1 = who then rest else s :: eraseSlot who rest

/-- And comes back by being appended, which is what a layer that kept only the
running apps could do. -/
def appendBack (who : String) (l : Layer) : Layer := l ++ [(who, true)]

/-- Suspending an app and loading it back returns the layer it was, so the app is
where it was and teardown reaches it in the same place. -/
theorem suspending_holds_the_place (a b c : String) (hab : a ≠ b) (hcb : c ≠ b) :
    restore b (suspend b (start a b c)) = start a b c := by
  simp [start, suspend, restore, hab, hcb]

/-- The same suspension and restore with the app removed and appended instead: it
serves either way, and teardown now reaches it first rather than in its place. -/
theorem appending_moves_the_app_to_the_end (a b c : String) (hab : a ≠ b) :
    running (appendBack b (eraseSlot b (start a b c))) = [a, c, b] ∧
    running (start a b c) = [a, b, c] := by
  refine ⟨?_, ?_⟩ <;> simp [running, start, eraseSlot, appendBack, hab]

end EffectApps
