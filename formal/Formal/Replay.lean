namespace Replay

structure View where
  app : Nat
  state : Nat

inductive Reading where
  | view (v : View) : Reading
  | other : Reading

def read : Reading → Option View
  | .view v => some v
  | .other => none

def isView : Reading → Bool
  | .view _ => true
  | .other => false

theorem the_check_the_reader_runs_decides : ∀ (r : Reading), (read r).isSome = isView r
  | .view _ => rfl
  | .other => rfl

theorem a_view_is_read_back_as_itself (v : View) : read (.view v) = some v := rfl

theorem a_reading_that_is_not_a_view_reads_as_nothing : read (.other : Reading) = none := rfl

theorem nothing_comes_back_that_the_frame_was_not_holding : ∀ (r : Reading) (v : View),
    read r = some v → r = Reading.view v
  | .view w, v, h => by
      rw [a_view_is_read_back_as_itself w] at h
      rw [Option.some.injEq] at h
      rw [h]
  | .other, _, h => by simp [read] at h

def oldRead (_ : Reading) : View := ⟨0, 0⟩

theorem the_old_reader_dropped_the_state_it_was_holding :
    oldRead (.view ⟨7, 9⟩) = ⟨0, 0⟩ ∧ read (.view ⟨7, 9⟩) = some ⟨7, 9⟩ := ⟨rfl, rfl⟩

end Replay
