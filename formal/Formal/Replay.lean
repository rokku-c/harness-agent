/-
  WHAT A RECORDED FRAME READS AS — `packages/effect-parity/src/replay.ts`.

  The monitor plane records the parity view it serves live, so a frame the agent
  perspective holds IS a parity view, and reading one back lets the human open on
  exactly what was captured. A frame is typed by nothing but what its sampler
  returned, and only the agent perspective samples a view.

  The file declared its own frame type — `id`, `capturedAt`, and a `data` that is
  a view — and said it was the structural shape of the store's, which is not the
  same type at all: a frame is filed under `at`, `perspective` and `target`, and
  its `data` is whatever the sampler returned. So the declaration claimed every
  frame holds a view, and reading a frame from any other perspective read fields
  that are not there: an app with no state, which renders as nothing and says
  nothing about why.

  Reading therefore runs the check first, and a reading that is not a view comes
  back as no view at all — the caller is told, instead of being handed an empty
  one. The view that does come back is the frame's own, field for field.

  Modelling note: the view is modelled by the app it is of and the state it
  captured, because the state is what replay is for and the rest is copied
  verbatim. Names are natural numbers for the same reason — nothing here compares
  them.
-/

namespace Replay

/-- A parity view as a frame holds it: the app it is of, and the state that was
    captured. -/
structure View where
  app : Nat
  state : Nat

/-- What a sampler returned. `view` is the reading the agent perspective records;
    `other` is a reading that is not a view, which the app and global
    perspectives record. -/
inductive Reading where
  | view (v : View) : Reading
  | other : Reading

/-- Read a frame back: the view it holds, or nothing. -/
def read : Reading → Option View
  | .view v => some v
  | .other => none

/-- Whether the reading is a view — the check the reader runs, and the whole of
    what it decides on. -/
def isView : Reading → Bool
  | .view _ => true
  | .other => false

/-- The check decides: a reading comes back as a view exactly when the check says
    it is one, so the two cannot disagree about a frame. -/
theorem the_check_the_reader_runs_decides : ∀ (r : Reading), (read r).isSome = isView r
  | .view _ => rfl
  | .other => rfl

/-- A reading that is a view comes back unchanged — the same app, the state that
    was captured — so the human opens on what was recorded and not on a
    reconstruction of it. -/
theorem a_view_is_read_back_as_itself (v : View) : read (.view v) = some v := rfl

/-- And a reading that is not a view reads as nothing, rather than as a view of
    an app with no state. -/
theorem a_reading_that_is_not_a_view_reads_as_nothing : read (.other : Reading) = none := rfl

/-- Nothing comes back that was not in the frame: whatever the reader returns is
    a view the frame was holding. -/
theorem nothing_comes_back_that_the_frame_was_not_holding : ∀ (r : Reading) (v : View),
    read r = some v → r = Reading.view v
  | .view w, v, h => by
      rw [a_view_is_read_back_as_itself w] at h
      rw [Option.some.injEq] at h
      rw [h]
  | .other, _, h => by simp [read] at h

/-- The control, and the bug in one line: the old declaration said a frame holds a
    view whatever it holds, so the reader had no way to answer "not a view" and
    answered with the empty one — the state it was holding came back as nothing,
    for every frame, and the panel rendered an app with no state. -/
def oldRead (_ : Reading) : View := ⟨0, 0⟩

theorem the_old_reader_dropped_the_state_it_was_holding :
    oldRead (.view ⟨7, 9⟩) = ⟨0, 0⟩ ∧ read (.view ⟨7, 9⟩) = some ⟨7, 9⟩ := ⟨rfl, rfl⟩

end Replay
