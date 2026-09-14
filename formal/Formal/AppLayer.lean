namespace EffectApps

abbrev Slot := String × Bool

abbrev Layer := List Slot

def start (a b c : String) : Layer := [(a, true), (b, true), (c, true)]

def running : Layer → List String
  | [] => []
  | s :: rest => if s.2 then s.1 :: running rest else running rest

def suspend (who : String) : Layer → Layer
  | [] => []
  | s :: rest => (s.1, if s.1 = who then false else s.2) :: suspend who rest

def restore (who : String) : Layer → Layer
  | [] => []
  | s :: rest => (s.1, if s.1 = who then true else s.2) :: restore who rest

def eraseSlot (who : String) : Layer → Layer
  | [] => []
  | s :: rest => if s.1 = who then rest else s :: eraseSlot who rest

def appendBack (who : String) (l : Layer) : Layer := l ++ [(who, true)]

theorem suspending_holds_the_place (a b c : String) (hab : a ≠ b) (hcb : c ≠ b) :
    restore b (suspend b (start a b c)) = start a b c := by
  simp [start, suspend, restore, hab, hcb]

theorem appending_moves_the_app_to_the_end (a b c : String) (hab : a ≠ b) :
    running (appendBack b (eraseSlot b (start a b c))) = [a, c, b] ∧
    running (start a b c) = [a, b, c] := by
  refine ⟨?_, ?_⟩ <;> simp [running, start, eraseSlot, appendBack, hab]

end EffectApps
