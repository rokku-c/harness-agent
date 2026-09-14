import Formal.Refresh

namespace EffectUi

inductive Gate where
  | unasked
  | declined
  | agreed

def gated (gate : Gate) (edits : List Edit) : List Edit :=
  match gate with
  | .declined => []
  | .unasked => edits
  | .agreed => edits

theorem declined_press_leaves_the_store (store : Store) (edits : List Edit) :
    apply store (gated .declined edits) = store := by
  simp [gated, apply]

theorem declined_press_empties_nothing (store : Store) (edits : List Edit) (path : String) :
    apply store (gated .declined edits) path = store path := by
  simp [gated, apply]

theorem declined_press_leaves_the_answer (store : Store) (edits : List Edit) (path value : String)
    (h : store path = some value) : apply store (gated .declined edits) path = some value := by
  rw [declined_press_empties_nothing, h]

theorem gate_never_adds_an_edit {gate : Gate} {edits : List Edit} {edit : Edit}
    (h : edit ∈ gated gate edits) : edit ∈ edits := by
  match gate with
  | .declined => simp [gated] at h
  | .unasked => simpa [gated] using h
  | .agreed => simpa [gated] using h

theorem unasked_press_is_the_press (edits : List Edit) : gated .unasked edits = edits := rfl

theorem agreed_press_is_the_press (edits : List Edit) : gated .agreed edits = edits := rfl

end EffectUi
