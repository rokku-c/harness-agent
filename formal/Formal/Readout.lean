/-
  The readout — `packages/effect-ui/src/readout.ts` — and the list's read state
  that shares its shape — `packages/effect-ui/src/source-status.ts`.

  Two prose claims hold these up, and nothing checked either.

  The first is that a readout is visible exactly when the path it binds carries
  something. It has to be, because the alternative is the bug the mechanism
  exists to prevent: a node guarded on one path while displaying another paints
  as an empty red box before the first press, and stays painted when the answer
  lands somewhere else. So the builder takes one path and gives it to both, and
  `readout_guard_is_bind` is that — the guard is not a second argument because
  there is nothing to pass.

  Modelling note: the runtime shows a guarded node when the value at its path is
  truthy, and this file says "carries a value". On the paths a readout is guarded
  by — a failure message — the two agree, and `carries` is the only thing the
  proofs below use.

  The second claim is the one `source-status.ts` makes about lists: an app cannot
  present a failure as an empty list, or an empty list as a failure. The verdict
  is one small function, so the claim is about it — a failure outranks
  everything, loading is only ever before the first answer, and empty and failed
  do not read alike.

  What is proven:

  * `readout_guard_is_bind` — the builder gives one path to both, so no readout
    can be built that watches where the answer is not written.
  * `readout_shows_iff` / `readout_hidden_before_the_press` — and so it is shown
    exactly when the path carries something, and hidden while it does not.
  * `unpaired_hides_an_answer` — the counterexample: written by hand, with the
    guard and the displayed path given separately, the message arrives and
    nothing shows it.
  * `failure_outranks_everything` — a list that could not be read is `failed`,
    whatever else is true of it.
  * `never_answered_reads_as_loading` / `loading_is_before_the_first_answer` /
    `answered_never_reads_as_loading` — loading is the state before the first
    answer and can never come back, so the placeholder cannot flash over rows the
    reader is looking at.
  * `a_failure_and_an_empty_list_do_not_read_alike` — the two are never the same
    verdict: no view can present one as the other.
  * `ready_carries_rows` — a list reads as ready only when it has rows in it.
-/

namespace EffectUi

/-! ### The readout -/

/-- What a view's state holds: a value at a path, or nothing at that path. -/
abbrev ViewState := String → Option String

/-- Whether a path carries a value. This is the whole test a guard makes. -/
def carries : Option String → Bool
  | none => false
  | some _ => true

/-- A node, as far as showing it goes: the path whose carrying shows it, and the
path whose value it displays. -/
structure Node where
  guard : Option String
  bind : Option String
deriving DecidableEq, Repr

/-- The readout builders: one path, given to the guard and to the display. -/
def readout (p : String) : Node := { guard := some p, bind := some p }

/-- A node shows when it is unguarded, or when its guard's path carries a value. -/
def shows (n : Node) (s : ViewState) : Bool :=
  match n.guard with
  | none => true
  | some p => carries (s p)

/-- Guard and display are one path: the builder has nothing to disagree with. -/
theorem readout_guard_is_bind (p : String) : (readout p).guard = (readout p).bind := rfl

/-- So it is shown exactly while the path carries something. -/
theorem readout_shows_iff (p : String) (s : ViewState) :
    shows (readout p) s = true ↔ carries (s p) = true := by
  simp [shows, readout]

/-- And hidden before the press that would write it: the readout is not an empty
red box waiting for an answer that has not been asked for. -/
theorem readout_hidden_before_the_press (p : String) (s : ViewState) (h : s p = none) :
    shows (readout p) s = false := by
  simp [shows, readout, carries, h]

/-! ### What the disagreement costs -/

/-- A node whose guard and displayed path were given separately — what the
builder exists to make impossible. -/
def unpaired (g b : String) : Node := { guard := some g, bind := some b }

/-- Written that way, the answer arrives and nothing shows it: the guard watches a
path the press never wrote, so the message sits in the state, unread. Stated as
both halves — the value *is* there, and the node is hidden anyway. -/
theorem unpaired_hides_an_answer (g b : String) (v : String) (s : ViewState)
    (hg : s g = none) (hb : s b = some v) :
    carries (s b) = true ∧ shows (unpaired g b) s = false := by
  refine ⟨by simp [carries, hb], ?_⟩
  simp [shows, unpaired, carries, hg]

/-! ### The list's read state -/

/-- The states a list has. `loading` is not one of its answers: it is what a list
reads as before it has ever been answered. -/
inductive Verdict where
  | loading
  | ready
  | empty
  | failed
deriving DecidableEq, Repr

/-- The verdict, in the one order `source-status.ts` states it: a failure
outranks everything. -/
def verdict (answered : Bool) (error : Option String) (count : Nat) : Verdict :=
  match error with
  | some _ => Verdict.failed
  | none => if answered then (if count = 0 then Verdict.empty else Verdict.ready) else Verdict.loading

/-- A failure outranks everything: whatever else is true of the list — whether it
has ever answered, how many rows it holds — an unreadable list reads as failed. -/
theorem failure_outranks_everything (answered : Bool) (e : String) (count : Nat) :
    verdict answered (some e) count = Verdict.failed := rfl

/-- A list that has never been answered reads as loading. -/
theorem never_answered_reads_as_loading (count : Nat) :
    verdict false none count = Verdict.loading := rfl

/-- And nothing else reads as loading: a list showing the placeholder has never
answered, and nothing said otherwise. -/
theorem loading_is_before_the_first_answer (e : Option String) (count : Nat)
    (h : verdict false e count = Verdict.loading) : e = none := by
  cases e with
  | none => rfl
  | some s => simp [verdict] at h

/-- Once a list has answered it never reads as loading again. -/
theorem answered_never_reads_as_loading (e : Option String) (count : Nat) :
    verdict true e count ≠ Verdict.loading := by
  cases e with
  | some s => simp [verdict]
  | none => by_cases h : count = 0 <;> simp [verdict, h]

/-- A failure and an empty list are never the same verdict, however many rows the
list holds: no view can present one as the other. -/
theorem a_failure_and_an_empty_list_do_not_read_alike (e : String) (count : Nat) :
    verdict true (some e) count ≠ verdict true none count := by
  by_cases h : count = 0 <;> simp [verdict, h]

/-- A list reads as ready only when it has rows in it. -/
theorem ready_carries_rows (answered : Bool) (e : Option String) (count : Nat)
    (h : verdict answered e count = Verdict.ready) : count ≠ 0 := by
  intro hc
  cases e with
  | some s => simp [verdict] at h
  | none => cases answered <;> simp [verdict, hc] at h

end EffectUi
